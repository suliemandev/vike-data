// The `notifications` table vike-notifications owns (the Stem pattern, like vike-auth
// owns `users`): one row per delivered in-app notification, tied to a user. Declared once
// through the neutral schema DSL, derived to whatever ORM the app runs, and contributed to
// the cumulative `schemas` point from +config.js, so installing vike-notifications adds
// the table with no app wiring.
//
// Only the built-in database channel writes it (database-channel.js); the mail/push
// channels deliver elsewhere. A row is created on delivery and flipped read via `read_at`.
import { defineSchema } from '@vike-data/vike-schema/schema'

export const notificationsSchema = defineSchema('notifications', (t) => {
  t.uuid('id').primary()
  t.uuid('user_id').references('users.id', { onDelete: 'cascade' })
  // The notification type (e.g. 'payment_failed') the UI can group/route on.
  t.string('type')
  // The rendered payload (notification.toDatabase().data), stored as a JSON string —
  // driver-neutral; no JSON column type assumed across ORMs.
  t.string('data')
  // null = unread; set to the read timestamp when the user reads it.
  t.timestamp('read_at').nullable()
  t.timestamps()
})

export default notificationsSchema
