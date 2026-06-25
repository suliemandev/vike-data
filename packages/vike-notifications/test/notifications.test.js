import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { clearQueue } from 'vike-queue'
import { createAuth, createStore, SESSION_COOKIE } from 'vike-auth'
import { notify, registerChannel, getChannel, getChannels, clearChannels } from '../index.js'
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
