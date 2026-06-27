// The `notifications` table vike-notifications owns (the Stem pattern, like vike-auth
// owns `users`): one row per delivered in-app notification, tied to a user. Declared once
// through the neutral schema DSL, derived to whatever ORM the app runs, and contributed to
// the cumulative `schemas` point from +config.js, so installing vike-notifications adds
// the table with no app wiring.
//
// Only the built-in database channel writes it (database-channel.js); the mail/push
// channels deliver elsewhere. A row is created on delivery and flipped read via `read_at`.
import { defineSchema } from '@vike-data/vike-schema/schema'
import { resolveOwner } from '@vike-data/kit'
import { resolveSubject } from 'vike-auth/subject'
import { getGuard, DEFAULT_GUARD_NAME } from 'vike-auth/guards'

// Build the table against a given owner table + column so the FK follows both axes: vike-auth's
// configurable subject (subject.js) AND the #250 owner binding (an organization instead of a
// user). `usersTable` defaults to the resolved subject name; `ownerColumn` defaults to `user_id`,
// so the single-owner call is byte-for-byte today's table. Tests call this with explicit names
// without touching env.
export function notificationsSchemaFor(usersTable = resolveSubject().users, ownerColumn = 'user_id') {
  return defineSchema('notifications', (t) => {
    t.uuid('id').primary()
    // The owner FK: column `user_id` -> the subject table by default; the #250 owner binding can
    // swap it to `organization_id` -> `organizations` so the feed is owned by an org, not a user.
    t.uuid(ownerColumn).references(`${usersTable}.id`, { onDelete: 'cascade' })
    // The notification type (e.g. 'payment_failed') the UI can group/route on.
    t.string('type')
    // The rendered payload (notification.toDatabase().data), stored as a JSON string —
    // driver-neutral; no JSON column type assumed across ORMs.
    t.string('data')
    // null = unread; set to the read timestamp when the user reads it.
    t.timestamp('read_at').nullable()
    t.timestamps()
  })
}

// Resolved once at import against the DEFAULT subject — the value tests and the default-guard
// path read. With no `VIKE_AUTH_SUBJECT_TABLE` override this is byte-for-byte the previous
// inline schema.
export const notificationsSchema = notificationsSchemaFor()

// The config-aware `schemas` contribution. Two orthogonal axes feed the `notifications` FK:
//
//   1. WHICH SUBJECT (#279 / #207 P3) — `config.notificationsGuard`, a guard name. Defaults to the
//      DEFAULT guard, whose subject is the env-configured `users` (resolveSubject). So no
//      `notificationsGuard` = today's table, and `notificationsGuard: 'client'` targets `clients`.
//      An unknown / not-yet-registered guard name falls back to the default subject rather than
//      mint an FK to a table no guard owns. The runtime feed + bare-id hydration follow the same
//      guard via VIKE_NOTIFICATIONS_GUARD (middleware.js / index.js).
//   2. WHICH OWNER (#250) — `config.notificationsOwner`, `{ table?, column? }`. The owner BINDING:
//      own the feed by a different KIND of subject (an organization) rather than the per-guard
//      user. Set `notificationsOwner: { table: 'organizations', column: 'organization_id' }` and
//      the FK becomes `organization_id -> organizations.id`; the runtime half writes/scopes the
//      feed by that column via VIKE_NOTIFICATIONS_OWNER_COLUMN and reads the owner id from
//      VIKE_NOTIFICATIONS_OWNER_FROM (middleware.js). Unset = the guard subject on `user_id`,
//      byte-for-byte.
//
// Vike hands this the resolved config (resolveSchemas(config.schemas, config)), the same
// build-time seam vike-stripe's subscriptionSchemas(config) uses. The owner binding wins over the
// guard subject table when it sets one (org ownership supersedes which user table); both default
// to the same single-owner `user_id` -> users shape, so the common app is untouched.
export function notificationsSchemas(config) {
  const guardName = config?.notificationsGuard || DEFAULT_GUARD_NAME
  const guard = getGuard(guardName)
  const guardTable = guard ? guard.subject.users : resolveSubject().users
  const { ownerTable, ownerColumn } = resolveOwner(guardTable, config?.notificationsOwner)
  return [notificationsSchemaFor(ownerTable, ownerColumn)]
}

export default notificationsSchema
