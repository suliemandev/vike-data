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
import { createStripe, signWebhook } from '../stripe.js'

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

test('a non-succeeded charge is ignored, no payments row (#234)', async () => {
  const { payments, db } = makePayments()
  // a failed status...
  const failed = await payments.recordCharge({ subject: 'org1', status: 'failed', stripePaymentIntentId: 'pi_f' })
  assert.deepEqual(failed, { ok: true, ignored: true })
  // ...and a non-success event TYPE (what the real SDK routes through the one endpoint)
  const wrongType = await payments.recordCharge({
    subject: 'org1', type: 'payment_intent.payment_failed', stripePaymentIntentId: 'pi_t',
  })
  assert.deepEqual(wrongType, { ok: true, ignored: true })
  assert.equal((await db.payments.find()).length, 0) // nothing recorded as a payment
})

test('the success event type is recorded (#234)', async () => {
  const { payments, db } = makePayments()
  const res = await payments.recordCharge({
    subject: 'org1', type: 'payment_intent.succeeded', amount: 500, stripePaymentIntentId: 'pi_ok',
  })
  assert.equal(res.ok, true)
  assert.equal((await db.payments.find()).length, 1)
})

test('paymentsFor returns only succeeded rows (#234)', async () => {
  const { payments, db } = makePayments()
  await payments.recordCharge({ subject: 'org1', amount: 100, stripePaymentIntentId: 'pi_1' })
  // a stray failed row written directly (e.g. legacy data) must not count as a payment
  await db.payments.insert({
    organization_id: 'org1', amount: 200, currency: 'usd', status: 'failed',
    description: null, stripe_payment_intent_id: 'pi_bad', paid_at: '2026-01-01T00:00:00.000Z',
  })
  const list = await payments.paymentsFor('org1')
  assert.equal(list.length, 1)
  assert.equal(list[0].stripe_payment_intent_id, 'pi_1')
})

test('a concurrent duplicate insert is caught and returns the existing row idempotently (#234)', async () => {
  // A db stub whose findOne misses (the race: both deliveries saw null) but whose insert
  // rejects on the unique constraint, then findOne returns the row the winner inserted.
  const winner = { id: 'p1', stripe_payment_intent_id: 'pi_race', status: 'succeeded' }
  let inserted = false
  const db = {
    payments: {
      async findOne() {
        return inserted ? winner : null
      },
      async insert() {
        inserted = true // the other delivery committed first
        throw new Error('UNIQUE constraint failed: payments.stripe_payment_intent_id')
      },
    },
  }
  const { createPayments } = await import('../purchase/payment.js')
  const payments = createPayments({ db, segment: 'b2b' })
  const res = await payments.recordCharge({ subject: 'org1', amount: 1, stripePaymentIntentId: 'pi_race' })
  assert.deepEqual(res, { ok: true, payment: winner, idempotent: true })
})

// -------------------------------------------------------------------- webhook
const SECRET = 'whsec_test_purchase'
const provider = createStripe({ webhookSecret: SECRET })
const handler = (payments) => purchaseWebhookHandler(payments, { provider })

// A correctly SIGNED POST (the signature covers the raw bytes we send).
const signedPost = (path, body, secret = SECRET) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signWebhook(raw, secret) },
    body: raw,
  })
}

// An UNSIGNED POST — what a forger who does not hold the secret can send.
const unsignedPost = (path, body) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

test('a signed webhook inserts and responds 200', async () => {
  const { payments, db } = makePayments()
  const res = await handler(payments)(
    signedPost(PURCHASE_WEBHOOK_PATH, { subject: 'org1', amount: 4200, stripePaymentIntentId: 'pi_9' }),
  )
  assert.equal(res.status, 200)
  assert.equal((await res.json()).payment.amount, 4200)
  assert.equal((await db.payments.find()).length, 1)
})

test('an UNSIGNED webhook is rejected 400, nothing written', async () => {
  const { payments, db } = makePayments()
  const res = await handler(payments)(
    unsignedPost(PURCHASE_WEBHOOK_PATH, { subject: 'org1', amount: 4200, stripePaymentIntentId: 'pi_x' }),
  )
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error, 'invalid-signature')
  assert.equal((await db.payments.find()).length, 0)
})

test('a payload signed with the WRONG secret is rejected 400, nothing written', async () => {
  const { payments, db } = makePayments()
  const res = await handler(payments)(
    signedPost(PURCHASE_WEBHOOK_PATH, { subject: 'org1', amount: 4200, stripePaymentIntentId: 'pi_x' }, 'whsec_wrong'),
  )
  assert.equal(res.status, 400)
  assert.equal((await db.payments.find()).length, 0)
})

test('a TAMPERED body (signature no longer matches) is rejected 400, nothing written', async () => {
  const { payments, db } = makePayments()
  const signature = signWebhook(JSON.stringify({ subject: 'org1', amount: 1, stripePaymentIntentId: 'pi_x' }), SECRET)
  const tampered = new Request(`http://localhost${PURCHASE_WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
    body: JSON.stringify({ subject: 'org1', amount: 999999, stripePaymentIntentId: 'pi_x' }),
  })
  const res = await handler(payments)(tampered)
  assert.equal(res.status, 400)
  assert.equal((await db.payments.find()).length, 0)
})

test('a signed but invalid-JSON body is a 400, nothing written', async () => {
  const { payments, db } = makePayments()
  const res = await handler(payments)(signedPost(PURCHASE_WEBHOOK_PATH, '{bad'))
  assert.equal(res.status, 400)
  assert.equal((await db.payments.find()).length, 0)
})
