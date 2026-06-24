// vike-queue — the config SEAM.
//
// It self-installs vike-schema (Vike's pre-serialized pointer-import string) and
// contributes its `jobs` table to the cumulative `schemas` point, so installing
// vike-queue adds the table the database driver uses with no app wiring — the same
// way vike-auth contributes `users`/`sessions`. An app that only ever uses the inline
// driver (the dev default) still gets the schema; it just stays empty.
//
// There is no UI and no runtime config here: the job registry and the driver are
// runtime registries (registerJob / setQueueDriver), because handlers and drivers are
// live code that can't be serialized into config.
import { jobsSchema } from './schema.js'

export default {
  name: 'vike-queue',
  extends: ['import:@vike-data/vike-schema/config:default'],
  schemas: [jobsSchema],
}
