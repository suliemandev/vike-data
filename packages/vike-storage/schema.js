// The `uploads` table vike-storage owns (the Stem pattern, like vike-push owns
// `push_subscriptions`): one row of METADATA per stored file, tied to the user who
// uploaded it. The bytes themselves live behind the storage port (in-memory in dev,
// S3/R2/disk in prod); this row records what they are and who owns them, and is what
// vike-admin renders for an `.as('file')` column.
//
// Declared once through the neutral schema DSL, derived to whatever ORM the app runs, and
// contributed to the cumulative `schemas` point from +config.js.
import { defineSchema } from '@vike-data/vike-schema/schema'

export const uploadsSchema = defineSchema('uploads', (t) => {
  t.uuid('id').primary()
  t.uuid('user_id').references('users.id', { onDelete: 'cascade' })
  // The provider key the bytes are stored under. Named storage_key, not `key`, because
  // `key` is a reserved word across several ORMs/databases (the same reason vike-push
  // uses auth_secret). Unique: one row per stored object.
  t.string('storage_key').unique()
  t.string('filename')
  t.string('mime')
  t.integer('size')
  t.timestamps()
})

export default uploadsSchema
