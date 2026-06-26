// The subscription model's COMPUTED schema: a plain, mutable `subscriptions` table
// (one row per subject), the shape the webhook upserts. The subject FK follows
// `segment` — 'b2b' points at `organizations`, 'b2c' points at `users` — and is
// UNIQUE: one current subscription per subject, the upsert conflict key.
//
// The FK TARGET TABLE is overridable via `config.subjectTable`, defaulting to the
// segment literal. vike-stripe deliberately does NOT import vike-auth/vike-teams
// (see #250 — billing stays decoupled), so it can't resolve a renamed subject
// itself; instead the app — which configured the rename — passes the resolved table
// name (`subjectTable: resolveSubject().users` for b2c, or the teams resolver for
// b2b). The FK COLUMN stays segment-derived. Default = today's literal, unchanged.
//
// Recurring subscriptions are this model; one-time charges are the `purchase` model.
import { defineSchema } from '@vike-data/vike-schema/schema'

export default function subscriptionSchemas(config) {
  const segment = config?.segment === 'b2c' ? 'b2c' : 'b2b'
  const column = segment === 'b2c' ? 'user_id' : 'organization_id'
  const defaultTable = segment === 'b2c' ? 'users' : 'organizations'
  const override = config?.subjectTable
  const table = override != null && String(override).trim() !== '' ? String(override).trim() : defaultTable
  const ref = { column, target: `${table}.id` }

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
