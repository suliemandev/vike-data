import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { clearQueue, setQueueDriver } from 'vike-queue'
import { createAuth, createStore, SESSION_COOKIE } from 'vike-auth'
import { defineGuard } from 'vike-auth/guards'
import { notify, registerChannel, getChannel, getChannels, clearChannels, routeFor, route } from '../index.js'
import { getFeed, unreadCount, markRead } from '../database-channel.js'
import { createNotificationsMiddleware } from '../middleware.js'

function setup() {
  clearChannels()
  clearQueue()
  clearAdapter()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  return adapter
}

// A notification factory — the plain-object shape a producer authors.
const paymentFailed = (invoice) => ({
  via: () => ['mail', 'database'],
  toMail: (u) => ({ to: u.email, subject: 'Payment failed', html: `Invoice ${invoice.id}` }),
  toDatabase: () => ({ type: 'payment_failed', data: { title: 'Payment failed', body: `Invoice ${invoice.id}` } }),
})

// Register a capturing channel for assertions; returns the captured-sends array.
function captureChannel(name) {
  const sent = []
  registerChannel({ name, send: async (notifiable, rendered) => { sent.push({ notifiable, rendered }) } })
  return sent
}

// Seed a feed row directly (controlled created_at so ordering is deterministic).
function feedRow(adapter, { id, user_id, created_at, read_at = null, data = { title: id } }) {
  return adapter.insert('notifications', {
    id, user_id, type: 't', data: JSON.stringify(data), read_at, created_at, updated_at: created_at,
  })
}

test('the built-in database channel is always registered', () => {
  setup()
  assert.equal(getChannel('database')?.name, 'database')
  assert.ok(getChannels().some((c) => c.name === 'database'))
})

test('routeFor resolves the conventional user field per channel (the #206 seam)', () => {
  const user = { id: 'u-1', email: 'a@b.c' }
  assert.equal(routeFor(user, 'mail'), 'a@b.c') // mail -> address
  assert.equal(routeFor(user, 'push'), 'u-1') // push -> user id
  assert.equal(routeFor(user, 'database'), 'u-1') // keyed on id
  assert.equal(routeFor(user, 'slack'), 'u-1') // unknown channel falls back to id
  assert.equal(routeFor(null, 'mail'), undefined) // tolerant of a missing notifiable
})

test('routeFor consults an explicit routes map before the user-field convention (#206)', () => {
  const onDemand = { routes: { mail: 'x@y.z', push: 'device-9' } }
  assert.equal(routeFor(onDemand, 'mail'), 'x@y.z') // explicit route, no user fields present
  assert.equal(routeFor(onDemand, 'push'), 'device-9')
  assert.equal(routeFor(onDemand, 'slack'), undefined) // no explicit route + no user field -> nothing to route to

  // On a User row, an explicit route overrides JUST that channel; the rest keep the convention.
  const user = { id: 'u-1', email: 'default@x.c', routes: { mail: 'billing@x.c' } }
  assert.equal(routeFor(user, 'mail'), 'billing@x.c') // explicit wins over .email
  assert.equal(routeFor(user, 'push'), 'u-1') // no explicit push route -> .id convention
})

test('route() builds an on-demand notifiable and validates its argument', () => {
  assert.deepEqual(route({ mail: 'a@b.c', push: 'dev-1' }), { routes: { mail: 'a@b.c', push: 'dev-1' } })
  assert.throws(() => route(), /channel: address/)
  assert.throws(() => route('a@b.c'), /channel: address/)
  assert.throws(() => route(['a@b.c']), /channel: address/) // an array is not a { channel: address } map
})

test('notify(route(...)) delivers to an explicit address with no user hydration and no feed row', async () => {
  const adapter = setup()
  const sent = []
  // The channel routes through routeFor against the projected (post-queue) notifiable.
  registerChannel({ name: 'mail', send: async (notifiable) => { sent.push(routeFor(notifiable, 'mail')) } })

  // A guest-checkout receipt: no users-table row exists, the target IS the address.
  const res = await notify(route({ mail: 'guest@checkout.io' }), {
    via: () => ['mail', 'database'], // database is selected but on-demand has no feed...
    toMail: () => ({ subject: 'Receipt', html: 'Thanks' }),
    // ...and no toDatabase(), so the feed channel renders nothing and is skipped — never errors.
  })

  assert.equal(sent[0], 'guest@checkout.io') // routed through the queue projection to the explicit address
  assert.equal(res.length, 1) // only mail delivered; the feed did not (no toDatabase)
  assert.equal((await adapter.find('notifications', {})).length, 0) // on-demand writes no feed row
})

test('notify carries an explicit routes map through the queue payload (survives serialization)', async () => {
  setup()
  const enqueued = []
  setQueueDriver({ enqueue: (job) => { enqueued.push(job); return Promise.resolve() } })
  registerChannel({ name: 'mail', send: async () => {} })

  await notify(route({ mail: 'ops@x.c' }), { via: () => ['mail'], toMail: () => ({ subject: 'Alert' }) })

  const { notifiable } = enqueued[0].payload
  assert.deepEqual(notifiable, { routes: { mail: 'ops@x.c' } }) // only the route data, nothing else
  assert.equal(routeFor(notifiable, 'mail'), 'ops@x.c') // and the worker can still resolve it
})

test('notify dispatches only the routable fields, never the full user row (#229)', async () => {
  const adapter = setup()
  // A hydrated user row carries a secret column (password_hash) alongside the routing fields.
  await adapter.insert('users', { id: 'u-1', email: 'a@b.c', password_hash: 'super-secret', name: 'A' })

  // Capture what notify hands the driver — exactly what the DB driver would persist.
  const enqueued = []
  setQueueDriver({ enqueue: (job) => { enqueued.push(job); return Promise.resolve() } })
  registerChannel({ name: 'mail', send: async () => {} })

  await notify('u-1', { via: () => ['mail'], toMail: (u) => ({ to: u.email }) })

  assert.equal(enqueued.length, 1)
  const { notifiable } = enqueued[0].payload
  assert.deepEqual(Object.keys(notifiable).sort(), ['email', 'id']) // projected to routable fields
  assert.equal('password_hash' in notifiable, false) // the secret is gone
  assert.equal(notifiable.email, 'a@b.c') // routing still works
})

test('registerChannel validates the channel', () => {
  setup()
  assert.throws(() => registerChannel({ name: 'x' }), /send\(notifiable, rendered\)/)
  assert.throws(() => registerChannel({ send: async () => {} }), /non-empty string name/)
})

test('notify fans out one job per selected+registered channel; database writes a row', async () => {
  const adapter = setup()
  const mail = captureChannel('mail')
  const user = { id: 'u-1', email: 'a@b.c' }

  const results = await notify(user, paymentFailed({ id: 'inv_9' }))

  assert.equal(results.length, 2) // mail + database
  assert.equal(mail.length, 1)
  assert.deepEqual(mail[0].rendered, { to: 'a@b.c', subject: 'Payment failed', html: 'Invoice inv_9' })

  const rows = await adapter.find('notifications', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, 'u-1')
  assert.equal(rows[0].type, 'payment_failed')
  assert.deepEqual(JSON.parse(rows[0].data), { title: 'Payment failed', body: 'Invoice inv_9' })
})

test('notify skips a selected channel that is not registered (no throw)', async () => {
  const adapter = setup()
  // no mail channel registered — via() still lists 'mail', but it is skipped
  const results = await notify({ id: 'u-1', email: 'a@b.c' }, paymentFailed({ id: 'inv_1' }))
  assert.equal(results.length, 1) // only database delivered
  assert.equal((await adapter.find('notifications', {})).length, 1)
})

test('notify hydrates a bare user id from the users table', async () => {
  const adapter = setup()
  await adapter.insert('users', { id: 'u-7', email: 'seven@example.com' })
  const dbOnly = {
    via: () => ['database'],
    toDatabase: () => ({ type: 'hi', data: { title: 'Hello' } }),
  }
  await notify('u-7', dbOnly) // a bare id, not a row
  const rows = await adapter.find('notifications', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, 'u-7') // resolved + delivered against the hydrated row
})

test('notify is a no-op when via() selects nothing', async () => {
  const adapter = setup()
  const res = await notify({ id: 'u-1' }, { via: () => [], toDatabase: () => ({ type: 't', data: {} }) })
  assert.deepEqual(res, [])
  assert.equal((await adapter.find('notifications', {})).length, 0)
})

test('getFeed returns newest first and hydrates data + the read flag', async () => {
  const adapter = setup()
  await feedRow(adapter, { id: 'n1', user_id: 'u1', created_at: '2026-01-01T00:00:00.000Z' })
  await feedRow(adapter, { id: 'n2', user_id: 'u1', created_at: '2026-01-02T00:00:00.000Z' })
  await feedRow(adapter, { id: 'n3', user_id: 'u1', created_at: '2026-01-03T00:00:00.000Z', read_at: '2026-01-03T01:00:00.000Z' })
  await feedRow(adapter, { id: 'other', user_id: 'u2', created_at: '2026-01-04T00:00:00.000Z' })

  const feed = await getFeed('u1')
  assert.deepEqual(feed.map((f) => f.id), ['n3', 'n2', 'n1']) // newest first, only u1's
  assert.equal(feed[0].read, true)
  assert.equal(feed[1].read, false)
  assert.deepEqual(feed[2].data, { title: 'n1' }) // JSON parsed back
})

test('unreadCount counts only the unread; markRead(ids) and markRead() (all)', async () => {
  const adapter = setup()
  await feedRow(adapter, { id: 'n1', user_id: 'u1', created_at: '2026-01-01T00:00:00.000Z' })
  await feedRow(adapter, { id: 'n2', user_id: 'u1', created_at: '2026-01-02T00:00:00.000Z' })
  await feedRow(adapter, { id: 'n3', user_id: 'u1', created_at: '2026-01-03T00:00:00.000Z' })

  assert.equal(await unreadCount('u1'), 3)
  assert.equal(await markRead('u1', 'n1'), 1) // single id
  assert.equal(await unreadCount('u1'), 2)
  assert.equal(await markRead('u1'), 2) // the rest (mark all)
  assert.equal(await unreadCount('u1'), 0)
  assert.equal(await markRead('u1'), 0) // nothing left to mark
})

test('markRead is owner-scoped — it cannot mark another user\'s notification', async () => {
  const adapter = setup()
  await feedRow(adapter, { id: 'n1', user_id: 'owner', created_at: '2026-01-01T00:00:00.000Z' })
  const marked = await markRead('attacker', ['n1']) // knows the id, but is not the owner
  assert.equal(marked, 0)
  assert.equal(await unreadCount('owner'), 1) // owner's row untouched
})

// Open a real session over the shared adapter and return its cookie header (mirrors the
// vike-push test): the middleware's resolveSessionUser reads the same session.
async function openSessionCookie(email) {
  const a = createAuth({ store: createStore() })
  const { token } = await a.requestMagicLink(email)
  const { session } = await a.redeemMagicLink(token)
  return `${SESSION_COOKIE}=${session.token}`
}

test('GET /notifications returns the signed-in user\'s feed + unread count', async () => {
  const adapter = setup()
  const cookie = await openSessionCookie('feed@example.com')
  const user = (await adapter.find('users', { email: 'feed@example.com' }))[0]
  await feedRow(adapter, { id: 'n1', user_id: user.id, created_at: '2026-01-01T00:00:00.000Z' })
  await feedRow(adapter, { id: 'n2', user_id: user.id, created_at: '2026-01-02T00:00:00.000Z', read_at: '2026-01-02T01:00:00.000Z' })

  const mw = createNotificationsMiddleware()
  const res = await mw(new Request('http://localhost/notifications', { headers: { cookie } }))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.unread, 1)
  assert.deepEqual(body.items.map((i) => i.id), ['n2', 'n1'])
})

test('GET /notifications is 401 without a session', async () => {
  setup()
  const mw = createNotificationsMiddleware()
  const res = await mw(new Request('http://localhost/notifications'))
  assert.equal(res.status, 401)
})

test('POST /notifications/read marks all (no ids) and specific ids, owner-scoped', async () => {
  const adapter = setup()
  const cookie = await openSessionCookie('reader@example.com')
  const user = (await adapter.find('users', { email: 'reader@example.com' }))[0]
  await feedRow(adapter, { id: 'n1', user_id: user.id, created_at: '2026-01-01T00:00:00.000Z' })
  await feedRow(adapter, { id: 'n2', user_id: user.id, created_at: '2026-01-02T00:00:00.000Z' })
  const mw = createNotificationsMiddleware()

  // mark one by id
  let res = await mw(new Request('http://localhost/notifications/read', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ ids: ['n1'] }),
  }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, marked: 1 })
  assert.equal(await unreadCount(user.id), 1)

  // mark the rest (omit ids)
  res = await mw(new Request('http://localhost/notifications/read', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({}),
  }))
  assert.deepEqual(await res.json(), { ok: true, marked: 1 })
  assert.equal(await unreadCount(user.id), 0)
})

test('POST /notifications/read is 401 without a session', async () => {
  setup()
  const mw = createNotificationsMiddleware()
  const res = await mw(new Request('http://localhost/notifications/read', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }))
  assert.equal(res.status, 401)
})

test('an unknown /notifications/ route is 404; a non-/notifications path falls through', async () => {
  setup()
  const mw = createNotificationsMiddleware()
  const r404 = await mw(new Request('http://localhost/notifications/nope', { method: 'POST' }))
  assert.equal(r404.status, 404)
  assert.deepEqual(await r404.json(), { error: 'unknown-notifications-route' })

  // not our prefix -> fall through to Vike (undefined)
  assert.equal(await mw(new Request('http://localhost/notifications-archive')), undefined)
  assert.equal(await mw(new Request('http://localhost/other')), undefined)
})

// #279 / #207 P3: the in-app feed + bare-id hydration follow the guard the app bound
// notifications to via VIKE_NOTIFICATIONS_GUARD. Open a session against a named guard (its own
// cookie + subject table), not the default subject.
async function openGuardSessionCookie(guard, email) {
  const { token } = await guard.instance.requestMagicLink(email)
  const { session } = await guard.instance.redeemMagicLink(token)
  return `${guard.cookieName}=${session.token}`
}

test('GET /notifications reads the feed of the configured guard subject (VIKE_NOTIFICATIONS_GUARD)', async () => {
  const adapter = setup()
  const client = defineGuard('notif-client', { table: 'clients' })
  process.env.VIKE_NOTIFICATIONS_GUARD = client.name
  try {
    const cookie = await openGuardSessionCookie(client, 'customer@example.com')
    // The feed subject is the CLIENT (from `clients`), and the row is scoped to its id — not a
    // default `users` row.
    const clientRow = (await adapter.find('clients', { email: 'customer@example.com' }))[0]
    assert.ok(clientRow, 'the client subject was created in its own `clients` table')
    await feedRow(adapter, { id: 'c1', user_id: clientRow.id, created_at: '2026-01-01T00:00:00.000Z' })

    const mw = createNotificationsMiddleware()
    const res = await mw(new Request('http://localhost/notifications', { headers: { cookie } }))
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.unread, 1)
    assert.deepEqual(body.items.map((i) => i.id), ['c1'])
  } finally {
    delete process.env.VIKE_NOTIFICATIONS_GUARD
  }
})

test('with VIKE_NOTIFICATIONS_GUARD set, a default-subject session cookie cannot read the feed', async () => {
  setup()
  const client = defineGuard('notif-client-x', { table: 'clients' })
  process.env.VIKE_NOTIFICATIONS_GUARD = client.name
  try {
    // A DEFAULT guard session (the bare `vike_auth_session` cookie) must NOT read the feed when
    // notifications are bound to the client guard — no cross-talk between audiences.
    const cookie = await openSessionCookie('default-user@example.com')
    const mw = createNotificationsMiddleware()
    const res = await mw(new Request('http://localhost/notifications', { headers: { cookie } }))
    assert.equal(res.status, 401)
  } finally {
    delete process.env.VIKE_NOTIFICATIONS_GUARD
  }
})

test('notify hydrates a bare id from the configured guard subject (VIKE_NOTIFICATIONS_GUARD)', async () => {
  const adapter = setup()
  const client = defineGuard('notif-client-h', { table: 'clients' })
  process.env.VIKE_NOTIFICATIONS_GUARD = client.name
  try {
    // The customer lives in the `clients` table; bound to the client guard, a bare id hydrates
    // from there, not the default `users`.
    await adapter.insert('clients', { id: 'c-1', email: 'cust@example.com' })
    const mail = captureChannel('mail')
    await notify('c-1', { via: () => ['mail'], toMail: (u) => ({ to: u.email }) })
    assert.equal(mail.length, 1)
    assert.equal(mail[0].notifiable.email, 'cust@example.com') // hydrated from `clients`
  } finally {
    delete process.env.VIKE_NOTIFICATIONS_GUARD
  }
})

test('without VIKE_NOTIFICATIONS_GUARD the feed is the default subject (byte-for-byte)', async () => {
  const adapter = setup()
  delete process.env.VIKE_NOTIFICATIONS_GUARD
  const cookie = await openSessionCookie('plain@example.com')
  const user = (await adapter.find('users', { email: 'plain@example.com' }))[0]
  await feedRow(adapter, { id: 'p1', user_id: user.id, created_at: '2026-01-01T00:00:00.000Z' })
  const mw = createNotificationsMiddleware()
  const res = await mw(new Request('http://localhost/notifications', { headers: { cookie } }))
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).items.map((i) => i.id), ['p1'])
})
