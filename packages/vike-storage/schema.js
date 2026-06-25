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

// Resolved once at import, the value contributed to the cumulative `schemas` point. With
// no `VIKE_AUTH_USERS_TABLE` override this is byte-for-byte the previous inline schema.
export const uploadsSchema = uploadsSchemaFor()

export default uploadsSchema
