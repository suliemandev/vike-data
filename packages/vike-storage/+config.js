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
import { uploadsSchema } from './schema.js'

export default {
  name: 'vike-storage',
  extends: ['import:@vike-data/vike-schema/config:default', 'import:vike-auth/config:default'],
  schemas: [uploadsSchema],
  middleware: 'import:vike-storage/middleware:default',
}
