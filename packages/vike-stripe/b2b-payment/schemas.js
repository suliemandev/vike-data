// The b2b-payment model's COMPUTED schema: a `payments` table, one row per charge.
// Unlike a subscription, a charge is immutable and there are MANY per subject, so the
// subject FK is NOT unique (a one-to-many). `stripe_payment_intent_id` is unique —
// the idempotency key, one row per Stripe charge.
//
// One-time charges are the b2b model; recurring subscriptions are b2c-subscription.
import { defineSchema } from '@vike-data/vike-schema/schema'

export default function paymentSchemas(config) {
  const subject = config?.billingSubject === 'user' ? 'user' : 'organization'
  const ref =
    subject === 'user'
      ? { column: 'user_id', target: 'users.id' }
      : { column: 'organization_id', target: 'organizations.id' }

  return [
    defineSchema('payments', (t) => {
      t.uuid('id').primary()
      t.uuid(ref.column).references(ref.target, { onDelete: 'cascade' }) // many per subject
      t.integer('amount') // smallest currency unit (cents)
      t.string('currency').default('usd')
      t.string('status').default('succeeded') // succeeded | failed | refunded
      t.string('description').nullable()
      t.string('stripe_payment_intent_id').unique() // idempotency key: one row per charge
      t.timestamp('paid_at')
      t.timestamp('created_at').default('now') // recorded at (a charge is immutable)
    }),
  ]
}
