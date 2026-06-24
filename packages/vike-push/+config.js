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
import { pushSubscriptionsSchema } from './schema.js'

export default {
  name: 'vike-push',
  extends: ['import:@vike-data/vike-schema/config:default', 'import:vike-auth/config:default'],
  schemas: [pushSubscriptionsSchema],
  middleware: 'import:vike-push/middleware:default',
  // The app's VAPID public key. The subscribe control (vike-push/react, /vue) reads it
  // off pageContext.config to build the PushManager applicationServerKey, so it must be
  // available client-side. The private key stays server-side (in the app's transport),
  // never here. Single value (the app sets it); plain data, so it serializes fine.
  meta: {
    vapidPublicKey: { env: { config: true, client: true } },
  },
  vapidPublicKey: null,
}
