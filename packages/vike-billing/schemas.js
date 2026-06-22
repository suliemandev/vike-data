// vike-billing's COMPUTED schema contribution — a plain, mutable `subscriptions`
// table.
//
// brillout's steer (the universal-orm thread): drop the event-sourced log +
// projection. Most apps don't model billing as an immutable event stream, and it
// is odd if only the extension does. So billing is one ordinary row per subject
// that the Stripe webhook UPSERTs — insert on the first event, update in place on
// later ones. Event-sourcing parks as a possible future IR shape (#26 / #44).
//
// The subject FK still follows `billingSubject` (the FK targets `organizations`
// for B2B, the default, or `users` per-seat), so the parameterization is
// preserved. The FK is UNIQUE: one subscription per subject, which the relation
// graph reads as a one-to-one and which is exactly the upsert conflict key.
import { defineSchema } from '@vike-data/vike-schema/schema'

export default function billingSchemas(config) {
  const subject = config?.billingSubject === 'user' ? 'user' : 'organization'
  const ref =
    subject === 'user'
      ? { column: 'user_id', target: 'users.id' }
      : { column: 'organization_id', target: 'organizations.id' }

  return [
    // One mutable subscription row per subject. The webhook upserts it keyed by
    // the subject FK (UNIQUE), so a replayed or out-of-order Stripe event always
    // converges to the same single row — never a duplicate.
    defineSchema('subscriptions', (t) => {
      t.uuid('id').primary()
      t.uuid(ref.column).unique().references(ref.target, { onDelete: 'cascade' })
      t.string('plan') // free | pro | enterprise
      t.string('status').default('active') // active | past_due | canceled
      t.integer('seats').default(1)
      t.string('stripe_customer_id').nullable()
      t.string('stripe_subscription_id').unique().nullable() // Stripe's own id, when known
      t.timestamp('current_period_end').nullable()
      t.timestamps() // created_at + updated_at: a mutable row, unlike the old event log
    }),
  ]
}
