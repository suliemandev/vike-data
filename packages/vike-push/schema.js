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

export const pushSubscriptionsSchema = defineSchema('push_subscriptions', (t) => {
  t.uuid('id').primary()
  t.uuid('user_id').references('users.id', { onDelete: 'cascade' })
  t.string('endpoint').unique()
  // The subscription's encryption material (subscription.keys.p256dh / .auth). Named
  // auth_secret to avoid `auth` as a column identifier across ORMs.
  t.string('p256dh')
  t.string('auth_secret')
  t.timestamps()
})

export default pushSubscriptionsSchema
