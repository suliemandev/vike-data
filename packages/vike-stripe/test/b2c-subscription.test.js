// b2c-subscription: the computed schema, the core upsert proof, and the webhook over
// a real Request/Response.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema, mergeSchemas, deriveRelations } from '@vike-data/vike-schema/schema'
import { mergeSchemas as merge } from '@vike-data/universal-schema'
import { createRepository } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import subscriptionSchemas from '../b2c-subscription/schemas.js'
import { createSubscriptions } from '../b2c-subscription/subscription.js'
import { subscriptionWebhookHandler, SUBSCRIPTION_WEBHOOK_PATH } from '../b2c-subscription/middleware.js'

const tableOf = (frags, name) => frags.find((f) => f.table === name)
const colOf = (frag, name) => frag.columns.find((c) => c.name === name)

function makeSubscriptions(subject = 'organization') {
  const { tables } = merge(subscriptionSchemas({ billingSubject: subject }))
  const db = createRepository({ tables }, createMemoryAdapter())
  return { subscriptions: createSubscriptions({ db, subject }), db }
}

// --------------------------------------------------------------------- schema
test('contributes exactly one plain subscriptions table', () => {
  assert.deepEqual(
    subscriptionSchemas({}).map((f) => [f.mode, f.table]),
    [['create', 'subscriptions']],
  )
})

test('billingSubject re-points the unique subject FK', () => {
  assert.deepEqual(colOf(tableOf(subscriptionSchemas({}), 'subscriptions'), 'organization_id').references, {
    table: 'organizations',
    column: 'id',
  })
  const u = tableOf(subscriptionSchemas({ billingSubject: 'user' }), 'subscriptions')
  assert.deepEqual(colOf(u, 'user_id').references, { table: 'users', column: 'id' })
  assert.equal(colOf(u, 'organization_id'), undefined)
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

// -------------------------------------------------------------------- webhook
const post = (path, body) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

test('webhook upserts and responds 200', async () => {
  const { subscriptions, db } = makeSubscriptions()
  const handle = subscriptionWebhookHandler(subscriptions)
  const res = await handle(post(SUBSCRIPTION_WEBHOOK_PATH, { subject: 'org1', plan: 'pro' }))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).subscription.plan, 'pro')
  assert.equal((await db.subscriptions.findOne({ organization_id: 'org1' })).plan, 'pro')
})

test('webhook falls through on other paths, 405 on non-POST', async () => {
  const handle = subscriptionWebhookHandler(makeSubscriptions().subscriptions)
  assert.equal(await handle(new Request('http://localhost/elsewhere')), undefined)
  assert.equal((await handle(new Request(`http://localhost${SUBSCRIPTION_WEBHOOK_PATH}`, { method: 'GET' }))).status, 405)
})
