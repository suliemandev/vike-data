// The b2c-subscription model's COMPUTED schema: a plain, mutable `subscriptions`
// table (one row per subject), the shape the webhook upserts. The subject FK
// follows `billingSubject` (organizations for B2B-style billing, users per-seat)
// and is UNIQUE — one current subscription per subject, the upsert conflict key.
//
// Recurring subscriptions are the b2c model; one-time charges are b2b-payment.
import { defineSchema } from '@vike-data/vike-schema/schema'

export default function subscriptionSchemas(config) {
  const subject = config?.billingSubject === 'user' ? 'user' : 'organization'
  const ref =
    subject === 'user'
      ? { column: 'user_id', target: 'users.id' }
      : { column: 'organization_id', target: 'organizations.id' }

  return [
    defineSchema('subscriptions', (t) => {
      t.uuid('id').primary()
      t.uuid(ref.column).unique().references(ref.target, { onDelete: 'cascade' })
      t.string('plan') // free | pro | enterprise
      t.string('status').default('active') // active | past_due | canceled
      t.integer('seats').default(1)
      t.string('stripe_customer_id').nullable()
      t.string('stripe_subscription_id').unique().nullable()
      t.timestamp('current_period_end').nullable()
      t.timestamps() // created_at + updated_at: a mutable row
    }),
  ]
}
