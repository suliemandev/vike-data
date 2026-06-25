// vike-notifications — the config SEAM.
//
// Self-installs vike-schema and vike-auth (the feed is per signed-in user), contributes
// its `notifications` table to the cumulative `schemas` point, and registers its feed
// endpoint through the cumulative `middleware` config. So installing vike-notifications
// adds the table and the /notifications routes with no app wiring.
//
// The server module (index.js, middleware.js) is pointer-imported (live code, server-only);
// the per-framework bell lives in vike-notifications/react and /vue and imports none of it.
import { notificationsSchema } from './schema.js'

export default {
  name: 'vike-notifications',
  extends: ['import:@vike-data/vike-schema/config:default', 'import:vike-auth/config:default'],
  schemas: [notificationsSchema],
  middleware: 'import:vike-notifications/middleware:default',
}
