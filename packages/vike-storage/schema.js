// The `uploads` table vike-storage owns (the Stem pattern, like vike-push owns
// `push_subscriptions`): one row of METADATA per stored file, tied to the user who
// uploaded it. The bytes themselves live behind the storage port (in-memory in dev,
// S3/R2/disk in prod); this row records what they are and who owns them, and is what
// vike-admin renders for an `.as('file')` column.
//
// Declared once through the neutral schema DSL, derived to whatever ORM the app runs, and
// contributed to the cumulative `schemas` point from +config.js.
import { defineSchema } from '@vike-data/vike-schema/schema'
import { resolveOwner } from '@vike-data/kit'
import { resolveSubject } from 'vike-auth/subject'
import { getGuard, DEFAULT_GUARD_NAME } from 'vike-auth/guards'

// Build the table against a given owner table + column so the FK follows both axes: vike-auth's
// configurable subject (subject.js) AND the #250 owner binding (an organization instead of a
// user). `usersTable` defaults to the resolved subject name; `ownerColumn` defaults to `user_id`,
// so the single-owner call is byte-for-byte today's table. Tests call this with explicit names
// without touching env.
export function uploadsSchemaFor(usersTable = resolveSubject().users, ownerColumn = 'user_id') {
  return defineSchema('uploads', (t) => {
    t.uuid('id').primary()
    // The owner FK: column `user_id` -> the subject table by default; the #250 owner binding can
    // swap it to `organization_id` -> `organizations` so a file is owned by an org, not a user.
    t.uuid(ownerColumn).references(`${usersTable}.id`, { onDelete: 'cascade' })
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

// The config-aware `schemas` contribution. Two orthogonal axes feed the `uploads` FK:
//
//   1. WHICH SUBJECT (#278 / #207 P3) — `config.storageGuard`, a guard name. Defaults to the
//      DEFAULT guard, whose subject is the env-configured `users` (resolveSubject). So no
//      `storageGuard` = today's table, and `storageGuard: 'admin'` targets `admins`. An unknown /
//      not-yet-registered guard name falls back to the default subject rather than mint an FK to a
//      table no guard owns. The runtime owner resolution follows the same guard via
//      VIKE_STORAGE_GUARD (middleware.js).
//   2. WHICH OWNER (#250) — `config.storageOwner`, `{ table?, column? }`. The owner BINDING: own
//      uploads by a different KIND of subject (an organization) rather than the per-guard user.
//      Set `storageOwner: { table: 'organizations', column: 'organization_id' }` and the FK
//      becomes `organization_id -> organizations.id`; the runtime half writes/scopes by that
//      column via VIKE_STORAGE_OWNER_COLUMN and reads the owner id from VIKE_STORAGE_OWNER_FROM
//      (middleware.js). Unset = the guard subject on `user_id`, byte-for-byte.
//
// Vike hands this the resolved config (resolveSchemas(config.schemas, config)), the same
// build-time seam vike-stripe's subscriptionSchemas(config) uses. The owner binding wins over the
// guard subject table when it sets one (org ownership supersedes which user table); both default
// to the same single-owner `user_id` -> users shape, so the common app is untouched.
export function uploadsSchemas(config) {
  const guardName = config?.storageGuard || DEFAULT_GUARD_NAME
  const guard = getGuard(guardName)
  const guardTable = guard ? guard.subject.users : resolveSubject().users
  const { ownerTable, ownerColumn } = resolveOwner(guardTable, config?.storageOwner)
  return [uploadsSchemaFor(ownerTable, ownerColumn)]
}

export default uploadsSchema
