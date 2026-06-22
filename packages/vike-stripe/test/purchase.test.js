// purchase: the computed schema, the core INSERT proof (idempotent on the Stripe
// payment-intent id), and the webhook over a real Request/Response.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema, mergeSchemas, deriveRelations } from '@vike-data/vike-schema/schema'
import { mergeSchemas as merge } from '@vike-data/universal-schema'
import { createRepository } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import paymentSchemas from '../purchase/schemas.js'
import { createPayments } from '../purchase/payment.js'
import { purchaseWebhookHandler, PURCHASE_WEBHOOK_PATH } from '../purchase/middleware.js'

const tableOf = (frags, name) => frags.find((f) => f.table === name)
const colOf = (frag, name) => frag.columns.find((c) => c.name === name)

function makePayments(segment = 'b2b') {
  const { tables } = merge(paymentSchemas({ segment }))
  const db = createRepository({ tables }, createMemoryAdapter())
  return { payments: createPayments({ db, segment }), db }
}

// --------------------------------------------------------------------- schema
test('contributes exactly one payments table', () => {
  assert.deepEqual(
    paymentSchemas({}).map((f) => [f.mode, f.table]),
    [['create', 'payments']],
  )
})

test('the subject FK is NOT unique (many payments per subject) => one-to-many', () => {
  const subs = tableOf(paymentSchemas({}), 'payments')
  assert.notEqual(colOf(subs, 'organization_id').unique, true)
  const subjectTables = [
    defineSchema('users', (t) => t.uuid('id').primary()),
    defineSchema('organizations', (t) => t.uuid('id').primary()),
  ]
  const { tables, conflicts } = mergeSchemas([...subjectTables, ...paymentSchemas({})])
  assert.deepEqual(conflicts, [])
  const fwd = deriveRelations(tables).get('payments').forward.find((r) => r.target === 'organizations')
  assert.equal(fwd.toOne, false)
})

test('segment re-points the subject FK (b2c -> users)', () => {
  const u = tableOf(paymentSchemas({ segment: 'b2c' }), 'payments')
  assert.deepEqual(colOf(u, 'user_id').references, { table: 'users', column: 'id' })
  assert.equal(colOf(u, 'organization_id'), undefined)
})

test('stripe_payment_intent_id is unique (the idempotency key)', () => {
  assert.equal(colOf(tableOf(paymentSchemas({}), 'payments'), 'stripe_payment_intent_id').unique, true)
})

// ----------------------------------------------------------------------- core
test('a charge INSERTs a payment row', async () => {
  const { payments, db } = makePayments()
  const res = await payments.recordCharge({ subject: 'org1', amount: 1999, stripePaymentIntentId: 'pi_1' })
  assert.equal(res.ok, true)
  assert.equal(res.payment.amount, 1999)
  assert.equal((await db.payments.find()).length, 1)
})

test('many charges accumulate as distinct rows for one subject', async () => {
  const { payments, db } = makePayments()
  await payments.recordCharge({ subject: 'org1', amount: 1000, stripePaymentIntentId: 'pi_1' })
  await payments.recordCharge({ subject: 'org1', amount: 2000, stripePaymentIntentId: 'pi_2' })
  assert.equal((await payments.paymentsFor('org1')).length, 2)
  assert.equal((await db.payments.find()).length, 2)
})

test('replaying a charge is idempotent on the payment-intent id (no duplicate)', async () => {
  const { payments, db } = makePayments()
  await payments.recordCharge({ subject: 'org1', amount: 1000, stripePaymentIntentId: 'pi_1' })
  const replay = await payments.recordCharge({ subject: 'org1', amount: 1000, stripePaymentIntentId: 'pi_1' })
  assert.equal(replay.idempotent, true)
  assert.equal((await db.payments.find()).length, 1)
})

test('a charge without an intent id or subject is rejected, nothing written', async () => {
  const { payments, db } = makePayments()
  assert.equal((await payments.recordCharge({ subject: 'org1' })).error, 'missing-payment-intent')
  assert.equal((await payments.recordCharge({ stripePaymentIntentId: 'pi_1' })).error, 'missing-subject')
  assert.equal((await db.payments.find()).length, 0)
})

// -------------------------------------------------------------------- webhook
const post = (path, body) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

test('webhook inserts and responds 200', async () => {
  const { payments, db } = makePayments()
  const handle = purchaseWebhookHandler(payments)
  const res = await handle(post(PURCHASE_WEBHOOK_PATH, { subject: 'org1', amount: 4200, stripePaymentIntentId: 'pi_9' }))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).payment.amount, 4200)
  assert.equal((await db.payments.find()).length, 1)
})

test('invalid JSON is a 400, nothing written', async () => {
  const { payments, db } = makePayments()
  const res = await purchaseWebhookHandler(payments)(post(PURCHASE_WEBHOOK_PATH, '{bad'))
  assert.equal(res.status, 400)
  assert.equal((await db.payments.find()).length, 0)
})
