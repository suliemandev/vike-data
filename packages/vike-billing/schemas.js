// vike-billing's COMPUTED schema contribution — now in an EVENT-SOURCED shape.
//
// Instead of one flat, mutable `subscriptions` row, billing is modelled the way
// the vike-dashboard reference does it: an append-only event log is the source of
// truth, and the current state is a rebuildable projection over it.
//
//   event__subscription_events  (append-only)  — every billing fact, immutable
//   computed__subscriptions      (projection)   — current state, folded from events
//
// Both still follow `billingSubject` (the FK targets `organizations` for B2B, the
// default, or `users` per-seat), so the parameterization from before is preserved.
//
// The `event__` / `computed__` prefixes are a NAMING CONVENTION — the schema IR
// has no first-class notion of "append-only" or "this table is a projection of
// that one". What the IR *can* express is called out inline; what it can't is the
// design note in this package's README (and the root README findings).
import { defineSchema } from '@vike-data/vike-schema/schema'

export default function billingSchemas(config) {
  const subject = config?.billingSubject === 'user' ? 'user' : 'organization'
  const ref =
    subject === 'user'
      ? { column: 'user_id', target: 'users.id' }
      : { column: 'organization_id', target: 'organizations.id' }

  return [
    // SOURCE OF TRUTH — append-only. Each row is an immutable billing fact.
    // Note: NO `updated_at` (and we don't use the timestamps() helper, which adds
    // one) — an append-only table is never updated. `stripe_event_id` UNIQUE is
    // the idempotency key: replaying a Stripe webhook can't double-insert. The IR
    // expresses the key (unique) but NOT the append-only constraint itself.
    defineSchema('event__subscription_events', (t) => {
      t.uuid('id').primary()
      t.uuid(ref.column).references(ref.target, { onDelete: 'cascade' })
      t.string('type') // created | renewed | plan_changed | canceled | past_due
      t.string('plan') // plan as of this event
      t.integer('seats').default(1)
      t.string('stripe_event_id').unique() // idempotency / replay-safe
      t.timestamp('occurred_at') // when the billing event happened (Stripe)
      t.timestamp('created_at').default('now') // when we recorded it (append-only)
    }),

    // PROJECTION — current subscription state, rebuildable by folding the events
    // above. Keyed one-per-subject (the FK is UNIQUE => a one-to-one relation),
    // so it reads like a normal `subscriptions` table while staying derived. The
    // IR can't express that this is a projection OF event__subscription_events;
    // the relationship is convention only.
    defineSchema('computed__subscriptions', (t) => {
      t.uuid('id').primary()
      t.uuid(ref.column).unique().references(ref.target, { onDelete: 'cascade' })
      t.string('plan') // free | pro | enterprise
      t.string('status').default('active') // active | past_due | canceled
      t.integer('seats').default(1)
      t.string('stripe_customer_id').nullable()
      t.timestamp('current_period_end').nullable()
      t.timestamp('updated_at').default('now') // last projection rebuild
    }),
  ]
}
