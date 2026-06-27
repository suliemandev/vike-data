// The `push_subscriptions` table vike-push owns (the Stem pattern, like vike-auth
// owns `users`): one row per browser push subscription, tied to a user. Declared once
// through the neutral schema DSL, derived to whatever ORM the app runs, and contributed
// to the cumulative `schemas` point from +config.js.
//
// A subscription is the browser's PushManager output: an `endpoint` URL plus two keys
// (`p256dh`, `auth`) the push service needs to encrypt the payload. `endpoint` is unique
// (re-subscribing updates the same row); a row is removed on unsubscribe or when the push
// service reports it gone.
import { defineSchema } from '@vike-data/vike-schema/schema'
import { resolveOwner } from '@vike-data/kit'
import { resolveSubject } from 'vike-auth/subject'

// Build the table against a given owner table + column so the FK follows both axes: vike-auth's
// configurable subject (subject.js) AND the #250 owner binding (an organization instead of a
// user). `usersTable` defaults to the resolved subject name; `ownerColumn` defaults to `user_id`,
// so the single-owner call is byte-for-byte today's table. Tests call this with explicit names
// without touching env.
export function pushSubscriptionsSchemaFor(usersTable = resolveSubject().users, ownerColumn = 'user_id') {
  return defineSchema('push_subscriptions', (t) => {
    t.uuid('id').primary()
    // The owner FK: column `user_id` -> the subject table by default; the #250 owner binding can
    // swap it to `organization_id` -> `organizations` so a subscription is owned by an org.
    t.uuid(ownerColumn).references(`${usersTable}.id`, { onDelete: 'cascade' })
    t.string('endpoint').unique()
    // The subscription's encryption material (subscription.keys.p256dh / .auth). Named
    // auth_secret to avoid `auth` as a column identifier across ORMs.
    t.string('p256dh')
    t.string('auth_secret')
    t.timestamps()
  })
}

// Resolved once at import against the DEFAULT subject on `user_id` — the value tests read. With
// no `VIKE_AUTH_SUBJECT_TABLE` override this is byte-for-byte the previous inline schema.
export const pushSubscriptionsSchema = pushSubscriptionsSchemaFor()

// The config-aware `schemas` contribution (#282 / #250). vike-push has no guard axis (it resolves
// against the default subject), so the default owner table is the env-configured `users`; the
// owner BINDING lets the app own subscriptions by a different KIND of subject. Set
// `pushOwner: { table: 'organizations', column: 'organization_id' }` and the FK becomes
// `organization_id -> organizations.id`; the runtime half writes/scopes by that column via
// VIKE_PUSH_OWNER_COLUMN and reads the owner id from VIKE_PUSH_OWNER_FROM (middleware.js). Unset =
// the default subject on `user_id`, byte-for-byte. Vike hands this the resolved config
// (resolveSchemas(config.schemas, config)), the same build-time seam vike-stripe's
// subscriptionSchemas(config) uses.
export function pushSubscriptionsSchemas(config) {
  const { ownerTable, ownerColumn } = resolveOwner(resolveSubject().users, config?.pushOwner)
  return [pushSubscriptionsSchemaFor(ownerTable, ownerColumn)]
}

export default pushSubscriptionsSchema
