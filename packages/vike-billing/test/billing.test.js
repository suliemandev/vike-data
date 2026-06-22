// The billing core — the universal-orm INSERT/upsert proof, ORM-agnostic. We run
// it over a real composed schema + the memory adapter (the same `db` the extension
// gets at runtime) and watch repeated subscription events converge to one row.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSchemas } from '@vike-data/universal-schema'
import { createRepository } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createBilling } from '../billing.js'
import billingSchemas from '../schemas.js'

function makeBilling(subject = 'organization') {
  const { tables } = mergeSchemas(billingSchemas({ billingSubject: subject }))
  const db = createRepository({ tables }, createMemoryAdapter())
  return { billing: createBilling({ db, subject }), db }
}

test('createBilling requires a universal-orm db', () => {
  assert.throws(() => createBilling({}), /requires a universal-orm/)
})

test('first event INSERTs a subscription row for the subject', async () => {
  const { billing } = makeBilling()
  const res = await billing.applySubscriptionEvent({ subject: 'org1', plan: 'pro', status: 'active' })
  assert.equal(res.ok, true)
  assert.equal(res.subscription.organization_id, 'org1')
  assert.equal(res.subscription.plan, 'pro')
  assert.equal(res.subscription.status, 'active')
})

test('repeated events UPSERT the same row (no duplicate) and converge state', async () => {
  const { billing, db } = makeBilling()
  // Each webhook is a full snapshot of the subscription, so the cancel event still
  // carries the current plan/seats — the core upserts exactly what it is given.
  await billing.applySubscriptionEvent({ subject: 'org1', plan: 'pro', status: 'active', seats: 1 })
  await billing.applySubscriptionEvent({ subject: 'org1', plan: 'enterprise', status: 'active', seats: 25 })
  await billing.applySubscriptionEvent({ subject: 'org1', plan: 'enterprise', status: 'canceled', seats: 25 })

  const all = await db.subscriptions.find()
  assert.equal(all.length, 1) // one row per subject, never duplicated
  assert.equal(all[0].plan, 'enterprise')
  assert.equal(all[0].status, 'canceled')
  assert.equal(all[0].seats, 25)
})

test('distinct subjects get distinct rows', async () => {
  const { billing, db } = makeBilling()
  await billing.applySubscriptionEvent({ subject: 'org1', plan: 'pro' })
  await billing.applySubscriptionEvent({ subject: 'org2', plan: 'free' })
  assert.equal((await db.subscriptions.find()).length, 2)
  assert.equal((await billing.subscriptionFor('org1')).plan, 'pro')
  assert.equal((await billing.subscriptionFor('org2')).plan, 'free')
})

test('an event without a subject is rejected, nothing is written', async () => {
  const { billing, db } = makeBilling()
  const res = await billing.applySubscriptionEvent({ plan: 'pro' })
  assert.deepEqual(res, { ok: false, error: 'missing-subject' })
  assert.equal((await db.subscriptions.find()).length, 0)
})

test('per-user subject upserts on user_id', async () => {
  const { billing, db } = makeBilling('user')
  await billing.applySubscriptionEvent({ subject: 'u1', plan: 'pro' })
  const row = await db.subscriptions.findOne({ user_id: 'u1' })
  assert.equal(row.plan, 'pro')
})
