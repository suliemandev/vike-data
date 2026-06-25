import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createAuth, createStore, SESSION_COOKIE } from 'vike-auth'
import {
  sendPush, saveSubscription, removeSubscription, pruneSubscription,
  getPushOutbox, clearPushOutbox, setPushTransport, clearPushTransport,
} from '../index.js'
import { createPushMiddleware } from '../middleware.js'

function setup() {
  clearAdapter()
  clearPushTransport()
  clearPushOutbox()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  return adapter
}

const sub = (endpoint) => ({ endpoint, keys: { p256dh: 'pub-' + endpoint, auth: 'sec-' + endpoint } })

test('saveSubscription stores a row, then refreshes the same row by endpoint', async () => {
  const adapter = setup()
  const a = await saveSubscription('u-1', sub('https://push/aaa'))
  assert.equal(a.created, true)
  let rows = await adapter.find('push_subscriptions', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, 'u-1')
  assert.equal(rows[0].p256dh, 'pub-https://push/aaa')

  // re-subscribe (same endpoint) updates in place, keeps the id, does not duplicate
  const b = await saveSubscription('u-2', sub('https://push/aaa'))
  assert.equal(b.updated, true)
  assert.equal(b.id, a.id)
  rows = await adapter.find('push_subscriptions', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, 'u-2')
})

test('sendPush delivers one payload per subscription the user has', async () => {
  setup()
  await saveSubscription('u-1', sub('https://push/aaa'))
  await saveSubscription('u-1', sub('https://push/bbb'))
  await saveSubscription('u-other', sub('https://push/ccc'))

  await sendPush('u-1', { title: 'Hi', body: 'yo' })

  const out = getPushOutbox()
  assert.equal(out.length, 2) // only u-1's two subscriptions
  const endpoints = out.map((o) => o.subscription.endpoint).sort()
  assert.deepEqual(endpoints, ['https://push/aaa', 'https://push/bbb'])
  assert.deepEqual(out[0].payload, { title: 'Hi', body: 'yo' })
  // the subscription is reconstructed with its keys
  assert.equal(out[0].subscription.keys.p256dh, 'pub-https://push/aaa')
})

test('sendPush is a no-op for a user with no subscriptions', async () => {
  setup()
  const res = await sendPush('nobody', { title: 'x' })
  assert.deepEqual(res, [])
  assert.equal(getPushOutbox().length, 0)
})

test('a registered transport replaces the default outbox', async () => {
  setup()
  const sent = []
  setPushTransport({ async send(subscription, payload) { sent.push({ subscription, payload }) } })
  await saveSubscription('u-1', sub('https://push/aaa'))
  await sendPush('u-1', { title: 'Routed' })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].payload.title, 'Routed')
  assert.equal(getPushOutbox().length, 0)
})

test('setPushTransport validates the transport', () => {
  setup()
  assert.throws(() => setPushTransport({}), /send\(subscription, payload\)/)
})

// Open a real session over the shared adapter and return its cookie header. Any auth
// instance backed by a composed store over the registered adapter sees the same session,
// which is exactly what the push middleware's resolveSessionUser (the singleton) reads.
async function openSessionCookie(email) {
  const a = createAuth({ store: createStore() })
  const { token } = await a.requestMagicLink(email)
  const { session } = await a.redeemMagicLink(token)
  return `${SESSION_COOKIE}=${session.token}`
}

test('POST /push/subscribe binds the subscription to the signed-in user', async () => {
  const adapter = setup()
  const cookie = await openSessionCookie('push@example.com')
  const mw = createPushMiddleware()

  const res = await mw(new Request('http://localhost/push/subscribe', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(sub('https://push/zzz')),
  }))

  assert.equal(res.status, 200)
  const user = (await adapter.find('users', { email: 'push@example.com' }))[0]
  const rows = await adapter.find('push_subscriptions', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, user.id)
  assert.equal(rows[0].endpoint, 'https://push/zzz')
})

test('POST /push/subscribe is 401 without a session', async () => {
  setup()
  const mw = createPushMiddleware()
  const res = await mw(new Request('http://localhost/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub('https://push/zzz')),
  }))
  assert.equal(res.status, 401)
  assert.equal(getPushOutbox().length, 0)
})

test('removeSubscription deletes the calling user\'s subscription by endpoint', async () => {
  const adapter = setup()
  await saveSubscription('u-1', sub('https://push/aaa'))
  await saveSubscription('u-1', sub('https://push/bbb'))
  await removeSubscription('u-1', 'https://push/aaa')
  const rows = await adapter.find('push_subscriptions', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].endpoint, 'https://push/bbb')
})

test('removeSubscription will not delete another user\'s subscription (IDOR guard)', async () => {
  const adapter = setup()
  await saveSubscription('u-1', sub('https://push/aaa'))
  // u-2 knows u-1's endpoint but is not its owner: the scoped delete matches nothing.
  const deleted = await removeSubscription('u-2', 'https://push/aaa')
  assert.equal(deleted, 0)
  const rows = await adapter.find('push_subscriptions', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, 'u-1')
})

test('POST /push/unsubscribe cannot remove another signed-in user\'s subscription', async () => {
  const adapter = setup()
  await openSessionCookie('owner@example.com')
  const cookieAttacker = await openSessionCookie('attacker@example.com')
  const owner = (await adapter.find('users', { email: 'owner@example.com' }))[0]
  await saveSubscription(owner.id, sub('https://push/aaa'))

  const mw = createPushMiddleware()
  // The attacker is signed in and sends the owner's endpoint.
  const res = await mw(new Request('http://localhost/push/unsubscribe', {
    method: 'POST',
    headers: { cookie: cookieAttacker, 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: 'https://push/aaa' }),
  }))

  // 200 (idempotent unsubscribe, no existence oracle), but the owner's row survives.
  assert.equal(res.status, 200)
  const rows = await adapter.find('push_subscriptions', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, owner.id)
})

test('POST /push/unsubscribe removes the caller\'s own subscription', async () => {
  const adapter = setup()
  const cookie = await openSessionCookie('owner@example.com')
  const owner = (await adapter.find('users', { email: 'owner@example.com' }))[0]
  await saveSubscription(owner.id, sub('https://push/own'))

  const mw = createPushMiddleware()
  const res = await mw(new Request('http://localhost/push/unsubscribe', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: 'https://push/own' }),
  }))

  assert.equal(res.status, 200)
  assert.equal((await adapter.find('push_subscriptions', {})).length, 0)
})

test('POST /push/subscribe with no endpoint is 400', async () => {
  const adapter = setup()
  const cookie = await openSessionCookie('a@example.com')
  const mw = createPushMiddleware()
  const res = await mw(new Request('http://localhost/push/subscribe', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ keys: { p256dh: 'x', auth: 'y' } }), // missing endpoint
  }))
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'invalid-subscription' })
  assert.equal((await adapter.find('push_subscriptions', {})).length, 0)
})

test('POST /push/unsubscribe with no endpoint is 400', async () => {
  setup()
  const cookie = await openSessionCookie('a@example.com')
  const mw = createPushMiddleware()
  const res = await mw(new Request('http://localhost/push/unsubscribe', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  }))
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'invalid-endpoint' })
})

test('a malformed JSON body is 400, not a 500', async () => {
  setup()
  const cookie = await openSessionCookie('a@example.com')
  const mw = createPushMiddleware()
  const res = await mw(new Request('http://localhost/push/subscribe', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{ not json',
  }))
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'invalid-subscription' })
})

test('a non-/push/ path falls through to Vike (returns undefined)', async () => {
  setup()
  const mw = createPushMiddleware()
  const res = await mw(new Request('http://localhost/some/other/path', { method: 'POST' }))
  assert.equal(res, undefined)
})

test('an unknown /push/ route is 404', async () => {
  setup()
  const mw = createPushMiddleware()
  const res = await mw(new Request('http://localhost/push/nope', { method: 'POST' }))
  assert.equal(res.status, 404)
  assert.deepEqual(await res.json(), { error: 'unknown-push-route' })
})

test('a known route with the wrong method is 404', async () => {
  setup()
  const mw = createPushMiddleware()
  const res = await mw(new Request('http://localhost/push/subscribe', { method: 'GET' }))
  assert.equal(res.status, 404)
})

test('a send that throws subscriptionGone prunes the dead row and does not retry', async () => {
  const adapter = setup()
  await saveSubscription('u-1', sub('https://push/gone'))
  await saveSubscription('u-1', sub('https://push/live'))

  let calls = 0
  setPushTransport({
    async send(subscription) {
      calls++
      if (subscription.endpoint === 'https://push/gone') {
        const err = new Error('subscription gone (410)')
        err.subscriptionGone = true
        throw err
      }
    },
  })

  // Inline driver runs the jobs immediately; sendPush resolves without throwing even though
  // one endpoint was gone (the handler swallows it after pruning).
  await sendPush('u-1', { title: 'Hi' })

  assert.equal(calls, 2) // one attempt each, NOT retried for the gone endpoint (maxAttempts 3)
  const rows = await adapter.find('push_subscriptions', {})
  assert.deepEqual(rows.map((r) => r.endpoint), ['https://push/live']) // the dead row is gone
})

test('a transient send error is NOT pruned and is retried', async () => {
  const adapter = setup()
  await saveSubscription('u-1', sub('https://push/flaky'))

  let calls = 0
  setPushTransport({
    async send() {
      calls++
      throw new Error('webPushTransport: push service responded 500') // unflagged = transient
    },
  })

  // sendPush dispatches per-subscription; the inline driver surfaces the final failure.
  await assert.rejects(() => sendPush('u-1', { title: 'Hi' }), /push service responded 500/)
  assert.equal(calls, 3) // retried up to maxAttempts (3), not pruned after the first failure
  const rows = await adapter.find('push_subscriptions', {})
  assert.equal(rows.length, 1) // the row survives a transient failure
})

test('pruneSubscription deletes by endpoint regardless of owner', async () => {
  const adapter = setup()
  await saveSubscription('u-1', sub('https://push/aaa'))
  await saveSubscription('u-2', sub('https://push/bbb'))
  const deleted = await pruneSubscription('https://push/aaa')
  assert.equal(deleted, 1)
  const rows = await adapter.find('push_subscriptions', {})
  assert.deepEqual(rows.map((r) => r.endpoint), ['https://push/bbb'])
})

test('saveSubscription normalizes a missing/partial keys object to null columns', async () => {
  const adapter = setup()
  await saveSubscription('u-1', { endpoint: 'https://push/nokeys' }) // no keys at all
  await saveSubscription('u-1', { endpoint: 'https://push/partial', keys: { p256dh: 'only-pub' } })
  const rows = await adapter.find('push_subscriptions', {})
  const byEndpoint = Object.fromEntries(rows.map((r) => [r.endpoint, r]))
  assert.equal(byEndpoint['https://push/nokeys'].p256dh, null)
  assert.equal(byEndpoint['https://push/nokeys'].auth_secret, null)
  assert.equal(byEndpoint['https://push/partial'].p256dh, 'only-pub')
  assert.equal(byEndpoint['https://push/partial'].auth_secret, null)
})
