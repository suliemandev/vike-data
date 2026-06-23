// The purchase model's COMPUTED schema: a `payments` table, one row per charge.
// Unlike a subscription, a charge is immutable and there are MANY per subject, so the
// subject FK is NOT unique (a one-to-many). `stripe_payment_intent_id` is unique —
// the idempotency key, one row per Stripe charge. The subject FK follows `segment`
// ('b2b' -> organizations, 'b2c' -> users).
//
// One-time charges are this model; recurring subscriptions are the `subscription` model.
import { defineSchema } from '@vike-data/vike-schema/schema'

export default function paymentSchemas(config) {
  const segment = config?.segment === 'b2c' ? 'b2c' : 'b2b'
  const ref =
    segment === 'b2c'
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
      t.timestamps({ updatedAt: false }) // created_at only: a charge is immutable, never updated
    }),
  ]
}
