// vike-notifications — the config SEAM.
//
// Self-installs vike-schema and vike-auth (the feed is per signed-in user), contributes
// its `notifications` table to the cumulative `schemas` point, and registers its feed
// endpoint through the cumulative `middleware` config. So installing vike-notifications
// adds the table and the /notifications routes with no app wiring.
//
// The server module (index.js, middleware.js) is pointer-imported (live code, server-only);
// the per-framework bell lives in vike-notifications/react and /vue and imports none of it.
export default {
  name: 'vike-notifications',
  extends: ['import:@vike-data/vike-schema/config:default', 'import:vike-auth/config:default'],
  // `notificationsGuard` (#279 / #207 P3): the named guard whose subject the in-app feed binds
  // to, defaulting to the default subject (`users`) so the common single-subject app is unchanged.
  // Exposed to the schema build (resolveSchemas reads it off the config) AND server-only so an app
  // can set it once; the runtime feed + hydration are bound through VIKE_NOTIFICATIONS_GUARD
  // (middleware.js / index.js), the same config/env split vike-stripe uses for
  // `segment`/`BILLING_SEGMENT`.
  meta: {
    notificationsGuard: { env: { config: true, server: true } },
  },
  // The `notifications` table is contributed as a COMPUTED schema — a function Vike calls with
  // the resolved config so the FK target follows `notificationsGuard` (default unset = the
  // default-subject table, byte-for-byte today's schema). Wired as a POINTER IMPORT (not an inline
  // function) because a function placed directly in a serialized config is rejected
  // ("runtime-in-config"); this is the exact shape vike-stripe's `subscriptionSchemas` uses.
  schemas: 'import:vike-notifications/schema:notificationsSchemas',
  middleware: 'import:vike-notifications/middleware:default',
}
