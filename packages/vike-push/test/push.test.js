import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createAuth, createStore, SESSION_COOKIE } from 'vike-auth'
import {
  sendPush, saveSubscription, removeSubscription,
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

test('removeSubscription deletes by endpoint', async () => {
  const adapter = setup()
  await saveSubscription('u-1', sub('https://push/aaa'))
  await saveSubscription('u-1', sub('https://push/bbb'))
  await removeSubscription('https://push/aaa')
  const rows = await adapter.find('push_subscriptions', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].endpoint, 'https://push/bbb')
})
