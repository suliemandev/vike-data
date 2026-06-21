// vike-billing's COMPUTED schema contribution.
//
// Instead of a static `schemas: [...]` array, billing contributes a FUNCTION of
// the resolved config. vike-schema calls it with the merged config, so the schema
// billing declares depends on the `billingSubject` option the app set:
//   - 'organization' (default, B2B): subscriptions.organization_id -> organizations
//   - 'user': subscriptions.user_id -> users
//
// This is the idiomatic Vike pattern (verified by spike): an extension declares a
// config key via meta, the app sets it, and the extension reads it — here to shape
// its contributed schema. Billing reaches vike-schema as a live function because
// +config.js wires it as a pointer-import (`import:vike-billing/schemas:default`);
// an inline function can't be serialized into a runtime (server-env) config.
import { defineSchema } from '@vike-data/vike-schema/schema'

export default function billingSchemas(config) {
  const subject = config?.billingSubject === 'user' ? 'user' : 'organization'
  const ref =
    subject === 'user'
      ? { column: 'user_id', target: 'users.id' }
      : { column: 'organization_id', target: 'organizations.id' }

  return [
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
  ]
}
