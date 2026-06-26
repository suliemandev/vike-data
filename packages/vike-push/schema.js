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
import { resolveSubject } from 'vike-auth/subject'

// Build the table against a given subject table so the FK target follows vike-auth's
// configurable subject (subject.js). `usersTable` defaults to the resolved name; tests
// call this with an explicit name without touching env.
export function pushSubscriptionsSchemaFor(usersTable = resolveSubject().users) {
  return defineSchema('push_subscriptions', (t) => {
    t.uuid('id').primary()
    // FK COLUMN stays `user_id`; only its TARGET follows a renamed users table.
    t.uuid('user_id').references(`${usersTable}.id`, { onDelete: 'cascade' })
    t.string('endpoint').unique()
    // The subscription's encryption material (subscription.keys.p256dh / .auth). Named
    // auth_secret to avoid `auth` as a column identifier across ORMs.
    t.string('p256dh')
    t.string('auth_secret')
    t.timestamps()
  })
}

// Resolved once at import, the value contributed to the cumulative `schemas` point. With
// no `VIKE_AUTH_SUBJECT_TABLE` override this is byte-for-byte the previous inline schema.
export const pushSubscriptionsSchema = pushSubscriptionsSchemaFor()

export default pushSubscriptionsSchema
