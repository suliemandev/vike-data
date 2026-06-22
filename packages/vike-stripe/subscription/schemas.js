// The subscription model's COMPUTED schema: a plain, mutable `subscriptions` table
// (one row per subject), the shape the webhook upserts. The subject FK follows
// `segment` — 'b2b' points at `organizations`, 'b2c' points at `users` — and is
// UNIQUE: one current subscription per subject, the upsert conflict key.
//
// Recurring subscriptions are this model; one-time charges are the `purchase` model.
import { defineSchema } from '@vike-data/vike-schema/schema'

export default function subscriptionSchemas(config) {
  const segment = config?.segment === 'b2c' ? 'b2c' : 'b2b'
  const ref =
    segment === 'b2c'
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
