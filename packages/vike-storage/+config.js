// vike-storage - the config SEAM.
//
// Self-installs vike-schema and vike-auth (it binds uploads to the signed-in user),
// contributes its `uploads` table to the cumulative `schemas` point, and registers its
// upload endpoint through the cumulative `middleware` config. So installing vike-storage adds
// the table and the /uploads routes with no app wiring.
//
// The server port + endpoint are pointer-imported (live code, server-only). The per-framework
// upload control + the vike-admin file widget live in the vike-storage/react and /vue subpaths
// (next PR) and import none of the server module.
export default {
  name: 'vike-storage',
  extends: ['import:@vike-data/vike-schema/config:default', 'import:vike-auth/config:default'],
  // `storageGuard` (#278 / #207 P3): the named guard whose subject OWNS uploads, defaulting
  // to the default subject (`users`) so the common single-subject app is unchanged. Exposed
  // to the schema build (resolveSchemas reads it off the config) AND server-only so an app
  // can set it once; the runtime owner is bound through VIKE_STORAGE_GUARD (middleware.js),
  // the same config/env split vike-stripe uses for `segment`/`BILLING_SEGMENT`.
  meta: {
    storageGuard: { env: { config: true, server: true } },
  },
  // The `uploads` table is contributed as a COMPUTED schema — a function Vike calls with the
  // resolved config so the FK target follows `storageGuard` (default unset = the default-subject
  // table, byte-for-byte today's schema). Wired as a POINTER IMPORT (not an inline function)
  // because a function placed directly in a serialized config is rejected ("runtime-in-config");
  // this is the exact shape vike-stripe's `subscriptionSchemas` uses.
  schemas: 'import:vike-storage/schema:uploadsSchemas',
  middleware: 'import:vike-storage/middleware:default',
}
