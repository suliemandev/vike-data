// The `uploads` table vike-storage owns (the Stem pattern, like vike-push owns
// `push_subscriptions`): one row of METADATA per stored file, tied to the user who
// uploaded it. The bytes themselves live behind the storage port (in-memory in dev,
// S3/R2/disk in prod); this row records what they are and who owns them, and is what
// vike-admin renders for an `.as('file')` column.
//
// Declared once through the neutral schema DSL, derived to whatever ORM the app runs, and
// contributed to the cumulative `schemas` point from +config.js.
import { defineSchema } from '@vike-data/vike-schema/schema'
import { resolveSubject } from 'vike-auth/subject'
import { getGuard, DEFAULT_GUARD_NAME } from 'vike-auth/guards'

// Build the table against a given subject table so the FK target follows vike-auth's
// configurable subject (subject.js). `usersTable` defaults to the resolved name; tests
// call this with an explicit name without touching env.
export function uploadsSchemaFor(usersTable = resolveSubject().users) {
  return defineSchema('uploads', (t) => {
    t.uuid('id').primary()
    // FK COLUMN stays `user_id`; only its TARGET follows a renamed users table.
    t.uuid('user_id').references(`${usersTable}.id`, { onDelete: 'cascade' })
    // The provider key the bytes are stored under. Named storage_key, not `key`, because
    // `key` is a reserved word across several ORMs/databases (the same reason vike-push
    // uses auth_secret). Unique: one row per stored object.
    t.string('storage_key').unique()
    t.string('filename')
    t.string('mime')
    t.integer('size')
    t.timestamps()
  })
}

// Resolved once at import against the DEFAULT subject — the value tests and the default-guard
// path read. With no `VIKE_AUTH_SUBJECT_TABLE` override this is byte-for-byte the previous
// inline schema.
export const uploadsSchema = uploadsSchemaFor()

// The config-aware `schemas` contribution (#278 / #207 P3): build `uploads` against the
// subject of the guard the app bound storage to — `config.storageGuard`, a guard name —
// defaulting to the DEFAULT guard, whose subject is the env-configured `users`
// (resolveSubject). So an app that sets no `storageGuard` gets byte-for-byte today's table,
// and one that sets `storageGuard: 'admin'` FKs `uploads.user_id` into `admins` instead.
// Vike hands this the resolved config (resolveSchemas(config.schemas, config)), the same
// build-time seam vike-stripe's subscriptionSchemas(config) uses. An unknown / not-yet-
// registered guard name falls back to the default subject rather than mint an FK to a table
// no guard owns. The runtime owner resolution follows the same guard via VIKE_STORAGE_GUARD
// (middleware.js) — the two halves are kept in sync by the app the way vike-stripe pairs
// `segment` with `BILLING_SEGMENT`.
export function uploadsSchemas(config) {
  const guardName = config?.storageGuard || DEFAULT_GUARD_NAME
  const guard = getGuard(guardName)
  const usersTable = guard ? guard.subject.users : resolveSubject().users
  return [uploadsSchemaFor(usersTable)]
}

export default uploadsSchema
