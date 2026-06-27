// vike-push - the config SEAM.
//
// Self-installs vike-schema and vike-auth (it binds subscriptions to the signed-in
// user), contributes its `push_subscriptions` table to the cumulative `schemas` point,
// and registers its subscribe endpoint through the cumulative `middleware` config. So
// installing vike-push adds the table and the /push/* routes with no app wiring.
//
// The server port + endpoint are pointer-imported (live code, server-only); the
// per-framework client control lives in the vike-push/react and vike-push/vue subpaths
// and imports none of the server module.
export default {
  name: 'vike-push',
  extends: ['import:@vike-data/vike-schema/config:default', 'import:vike-auth/config:default'],
  // The `push_subscriptions` table is contributed as a COMPUTED schema — a function Vike calls
  // with the resolved config so the FK follows `pushOwner` (#250; default unset = the
  // default-subject table on `user_id`, byte-for-byte today's schema). Wired as a POINTER IMPORT
  // (not an inline function) because a function placed directly in a serialized config is rejected
  // ("runtime-in-config"); the exact shape vike-stripe's `subscriptionSchemas` uses.
  schemas: 'import:vike-push/schema:pushSubscriptionsSchemas',
  middleware: 'import:vike-push/middleware:default',
  // `vapidPublicKey`: the app's VAPID public key. The subscribe control (vike-push/react, /vue)
  // reads it off pageContext.config to build the PushManager applicationServerKey, so it must be
  // available client-side. The private key stays server-side (in the app's transport), never here.
  // `pushOwner` (#250 / #282): `{ table?, column? }`, the owner BINDING — own subscriptions by a
  // different KIND of subject (an organization) rather than the auth user. Read off the config at
  // schema build (resolveSchemas) and server-only so an app sets it once; the runtime owner is
  // bound through VIKE_PUSH_OWNER_COLUMN + VIKE_PUSH_OWNER_FROM (middleware.js), the same config/env
  // split vike-stripe uses for `segment`/`BILLING_SEGMENT`.
  meta: {
    vapidPublicKey: { env: { config: true, client: true } },
    pushOwner: { env: { config: true, server: true } },
  },
  vapidPublicKey: null,
}
