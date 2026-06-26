// subscription: the computed schema, the core upsert proof, and the webhook over
// a real Request/Response.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema, mergeSchemas, deriveRelations } from '@vike-data/vike-schema/schema'
import { mergeSchemas as merge } from '@vike-data/universal-schema'
import { createRepository } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import subscriptionSchemas from '../subscription/schemas.js'
import { createSubscriptions } from '../subscription/subscription.js'
import { subscriptionWebhookHandler, SUBSCRIPTION_WEBHOOK_PATH } from '../subscription/middleware.js'
import { onSubscriptionEvent, clearSubscriptionObservers } from '../subscription/events.js'
import { createStripe, signWebhook } from '../stripe.js'

const tableOf = (frags, name) => frags.find((f) => f.table === name)
const colOf = (frag, name) => frag.columns.find((c) => c.name === name)

function makeSubscriptions(segment = 'b2b') {
  const { tables } = merge(subscriptionSchemas({ segment }))
  const db = createRepository({ tables }, createMemoryAdapter())
  return { subscriptions: createSubscriptions({ db, segment }), db }
}

// --------------------------------------------------------------------- schema
test('contributes exactly one plain subscriptions table', () => {
  assert.deepEqual(
    subscriptionSchemas({}).map((f) => [f.mode, f.table]),
    [['create', 'subscriptions']],
  )
})

test('segment re-points the unique subject FK (b2b -> organizations, b2c -> users)', () => {
  assert.deepEqual(colOf(tableOf(subscriptionSchemas({}), 'subscriptions'), 'organization_id').references, {
    table: 'organizations',
    column: 'id',
  })
  const u = tableOf(subscriptionSchemas({ segment: 'b2c' }), 'subscriptions')
  assert.deepEqual(colOf(u, 'user_id').references, { table: 'users', column: 'id' })
  assert.equal(colOf(u, 'organization_id'), undefined)
})

test('subjectTable overrides the FK target table; the column stays segment-derived (#259)', () => {
  // b2c renamed subject: app passes the resolved table name, FK column unchanged.
  const b2c = tableOf(subscriptionSchemas({ segment: 'b2c', subjectTable: 'accounts' }), 'subscriptions')
  assert.deepEqual(colOf(b2c, 'user_id').references, { table: 'accounts', column: 'id' })
  // b2b renamed subject (e.g. organizations -> teams).
  const b2b = tableOf(subscriptionSchemas({ segment: 'b2b', subjectTable: 'teams' }), 'subscriptions')
  assert.deepEqual(colOf(b2b, 'organization_id').references, { table: 'teams', column: 'id' })
  // blank/whitespace override falls back to the segment default.
  const def = tableOf(subscriptionSchemas({ segment: 'b2c', subjectTable: '  ' }), 'subscriptions')
  assert.deepEqual(colOf(def, 'user_id').references, { table: 'users', column: 'id' })
})

test('the subject FK is unique => one-to-one relation when merged', () => {
  const subjectTables = [
    defineSchema('users', (t) => t.uuid('id').primary()),
    defineSchema('organizations', (t) => t.uuid('id').primary()),
  ]
  const { tables, conflicts } = mergeSchemas([...subjectTables, ...subscriptionSchemas({})])
  assert.deepEqual(conflicts, [])
  const fwd = deriveRelations(tables).get('subscriptions').forward.find((r) => r.target === 'organizations')
  assert.equal(fwd.toOne, true)
})

// ----------------------------------------------------------------------- core
test('repeated events UPSERT one row and converge state', async () => {
  const { subscriptions, db } = makeSubscriptions()
  await subscriptions.applySubscriptionEvent({ subject: 'org1', plan: 'pro', status: 'active', seats: 1 })
  await subscriptions.applySubscriptionEvent({ subject: 'org1', plan: 'enterprise', status: 'canceled', seats: 25 })
  const all = await db.subscriptions.find()
  assert.equal(all.length, 1)
  assert.equal(all[0].plan, 'enterprise')
  assert.equal(all[0].status, 'canceled')
  assert.equal(all[0].seats, 25)
})

test('a subjectless event is rejected, nothing written', async () => {
  const { subscriptions, db } = makeSubscriptions()
  assert.deepEqual(await subscriptions.applySubscriptionEvent({ plan: 'pro' }), { ok: false, error: 'missing-subject' })
  assert.equal((await db.subscriptions.find()).length, 0)
})

test('a stale (out-of-order) event does not overwrite newer state (#234)', async () => {
  const { subscriptions, db } = makeSubscriptions()
  // canceled happened at T2; a delayed/retried `active` event from T1 arrives afterwards.
  await subscriptions.applySubscriptionEvent({
    subject: 'org1', plan: 'pro', status: 'canceled', occurredAt: '2026-01-02T00:00:00.000Z',
  })
  const res = await subscriptions.applySubscriptionEvent({
    subject: 'org1', plan: 'pro', status: 'active', occurredAt: '2026-01-01T00:00:00.000Z',
  })
  assert.equal(res.stale, true)
  // the newer canceled state is preserved: a canceled subscriber is NOT re-granted access
  assert.equal((await db.subscriptions.findOne({ organization_id: 'org1' })).status, 'canceled')
})

test('a newer event applies over older state (ordering respected)', async () => {
  const { subscriptions, db } = makeSubscriptions()
  await subscriptions.applySubscriptionEvent({
    subject: 'org1', plan: 'pro', status: 'past_due', occurredAt: '2026-01-01T00:00:00.000Z',
  })
  const res = await subscriptions.applySubscriptionEvent({
    subject: 'org1', plan: 'pro', status: 'active', occurredAt: '2026-01-02T00:00:00.000Z',
  })
  assert.ok(!res.stale)
  assert.equal((await db.subscriptions.findOne({ organization_id: 'org1' })).status, 'active')
})

// -------------------------------------------------------------------- webhook
const SECRET = 'whsec_test_subscription'
const provider = createStripe({ webhookSecret: SECRET })
const handler = (subscriptions) => subscriptionWebhookHandler(subscriptions, { provider })

const signedPost = (path, body, secret = SECRET) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signWebhook(raw, secret) },
    body: raw,
  })
}

test('a signed webhook upserts and responds 200', async () => {
  const { subscriptions, db } = makeSubscriptions()
  const res = await handler(subscriptions)(signedPost(SUBSCRIPTION_WEBHOOK_PATH, { subject: 'org1', plan: 'pro' }))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).subscription.plan, 'pro')
  assert.equal((await db.subscriptions.findOne({ organization_id: 'org1' })).plan, 'pro')
})

test('an unsigned webhook cannot set a subscription (400, nothing written)', async () => {
  const { subscriptions, db } = makeSubscriptions()
  const unsigned = new Request(`http://localhost${SUBSCRIPTION_WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'org1', plan: 'enterprise', seats: 9999 }),
  })
  const res = await handler(subscriptions)(unsigned)
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error, 'invalid-signature')
  assert.equal((await db.subscriptions.find()).length, 0)
})

test('a payload signed with the wrong secret is rejected (400, nothing written)', async () => {
  const { subscriptions, db } = makeSubscriptions()
  const res = await handler(subscriptions)(
    signedPost(SUBSCRIPTION_WEBHOOK_PATH, { subject: 'org1', plan: 'enterprise' }, 'whsec_wrong'),
  )
  assert.equal(res.status, 400)
  assert.equal((await db.subscriptions.find()).length, 0)
})

test('b2c segment keys the row on user_id', async () => {
  const { subscriptions, db } = makeSubscriptions('b2c')
  await subscriptions.applySubscriptionEvent({ subject: 'user1', plan: 'pro' })
  assert.equal((await db.subscriptions.findOne({ user_id: 'user1' })).plan, 'pro')
})

test('webhook falls through on other paths, 405 on non-POST', async () => {
  const handle = handler(makeSubscriptions().subscriptions)
  assert.equal(await handle(new Request('http://localhost/elsewhere')), undefined)
  assert.equal((await handle(new Request(`http://localhost${SUBSCRIPTION_WEBHOOK_PATH}`, { method: 'GET' }))).status, 405)
})

// ---------------------------------------------------------------- event seam
test('applySubscriptionEvent emits to observers with the prior status (the transition)', async () => {
  clearSubscriptionObservers()
  const { subscriptions } = makeSubscriptions('b2c')
  const seen = []
  onSubscriptionEvent((payload) => seen.push(payload))

  await subscriptions.applySubscriptionEvent({ subject: 'user1', plan: 'pro', status: 'active' })
  await subscriptions.applySubscriptionEvent({ subject: 'user1', plan: 'pro', status: 'past_due' })

  assert.equal(seen.length, 2)
  assert.equal(seen[0].previousStatus, null) // first apply: no prior row
  assert.equal(seen[0].subscription.status, 'active')
  assert.equal(seen[1].previousStatus, 'active') // the transition active -> past_due
  assert.equal(seen[1].subscription.status, 'past_due')
  assert.equal(seen[1].subjectColumn, 'user_id')
  clearSubscriptionObservers()
})

test('an observer that throws does not break applySubscriptionEvent', async () => {
  clearSubscriptionObservers()
  const { subscriptions, db } = makeSubscriptions('b2c')
  onSubscriptionEvent(() => { throw new Error('observer boom') })

  const res = await subscriptions.applySubscriptionEvent({ subject: 'user1', status: 'active' })
  assert.equal(res.ok, true) // the upsert still succeeded
  assert.equal((await db.subscriptions.findOne({ user_id: 'user1' })).status, 'active')
  clearSubscriptionObservers()
})

test('onSubscriptionEvent returns an unsubscribe', async () => {
  clearSubscriptionObservers()
  const { subscriptions } = makeSubscriptions('b2c')
  let count = 0
  const off = onSubscriptionEvent(() => { count++ })
  await subscriptions.applySubscriptionEvent({ subject: 'user1', status: 'active' })
  off()
  await subscriptions.applySubscriptionEvent({ subject: 'user1', status: 'past_due' })
  assert.equal(count, 1)
  clearSubscriptionObservers()
})
