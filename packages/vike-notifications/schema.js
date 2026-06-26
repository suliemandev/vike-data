// The `notifications` table vike-notifications owns (the Stem pattern, like vike-auth
// owns `users`): one row per delivered in-app notification, tied to a user. Declared once
// through the neutral schema DSL, derived to whatever ORM the app runs, and contributed to
// the cumulative `schemas` point from +config.js, so installing vike-notifications adds
// the table with no app wiring.
//
// Only the built-in database channel writes it (database-channel.js); the mail/push
// channels deliver elsewhere. A row is created on delivery and flipped read via `read_at`.
import { defineSchema } from '@vike-data/vike-schema/schema'
import { resolveSubject } from 'vike-auth/subject'

// Build the table against a given subject table so the FK target follows vike-auth's
// configurable subject (subject.js). `usersTable` defaults to the resolved name; tests
// call this with an explicit name without touching env.
export function notificationsSchemaFor(usersTable = resolveSubject().users) {
  return defineSchema('notifications', (t) => {
    t.uuid('id').primary()
    // FK COLUMN stays `user_id`; only its TARGET follows a renamed users table.
    t.uuid('user_id').references(`${usersTable}.id`, { onDelete: 'cascade' })
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

// Resolved once at import, the value contributed to the cumulative `schemas` point. With
// no `VIKE_AUTH_SUBJECT_TABLE` override this is byte-for-byte the previous inline schema.
export const notificationsSchema = notificationsSchemaFor()

export default notificationsSchema
