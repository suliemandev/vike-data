// vike-billing's factory, kept OUT of +config.js (Vike +config files must export
// only a default — a named export there trips the no-side-exports warning).
//
// Billing can bill against an organization (B2B) or a user (individual), which
// changes both its FK and what it composes on:
//   - subject 'organization' -> subscriptions.organization_id FK into vike-teams'
//     `organizations`; self-installs vike-teams.
//   - subject 'user' -> subscriptions.user_id FK into vike-auth's `users`;
//     self-installs vike-auth directly (no teams needed).
//
// Either way it's a real, validated FK, and it needs NO vike-data core change —
// the contributed schema is just plain data built from the option.
//
// FINDING (Vike binding constraint): you CANNOT install this as
// `extends: [billingFor('user')]` inside a +config.js — Vike rewrites config-file
// imports to pointers, so an imported extension config can't be *called* there
// (it surfaces as `billingFor is not a function`). `extends` takes config objects
// / pointers, not options. So +config.js ships a sensible DEFAULT (the
// organization subject) that installs like any extension, and the factory is used
// directly from vike-data's codegen driver (plain JS, not bound by Vike's config
// serialization), where BILLING_SUBJECT picks the subject. Whether passing
// install-time options to a Vike extension deserves a blessed pattern is a
// question for Vike core.
import { defineSchema } from '@vike-data/vike-schema/schema'

export function billingFor(subjectInput) {
  const subject = subjectInput === 'user' ? 'user' : 'organization'
  const ref =
    subject === 'user'
      ? { column: 'user_id', target: 'users.id', install: 'vike-auth' }
      : { column: 'organization_id', target: 'organizations.id', install: 'vike-teams' }

  return {
    name: 'vike-billing',
    // Self-install the right base for the chosen subject. The chain composes from
    // one install: vike-schema <- vike-auth [<- vike-teams] <- vike-billing.
    extends: [`import:${ref.install}/config:default`],
    schemas: [
      defineSchema('subscriptions', (t) => {
        t.uuid('id').primary()
        t.uuid(ref.column).references(ref.target, { onDelete: 'cascade' })
        t.string('plan') // free | pro | enterprise
        t.string('status').default('active') // active | past_due | canceled
        t.integer('seats').default(1)
        t.string('stripe_customer_id').nullable()
        t.timestamp('current_period_end').nullable()
        t.timestamps()
      }),
    ],
  }
}
