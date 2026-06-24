// Demo of the schema-driven file field (#176 -> #177 -> #178). The app extends vike-auth's
// `users` table with an `avatar` column declared `.as('file')`. That semantic flows through
// the composed schema to vike-admin, which - because vike-storage registered a `file` widget
// (storageAdminExt below) - renders the Users form's avatar field as an upload control. No
// bespoke admin code: a column says it holds a file, and the right control appears.
//
// Contributed through the cumulative `schemas` config in +config.js. extendSchema adds to a
// table ANOTHER extension created, the same cross-extension seam vike-teams uses on `users`.
import { extendSchema } from '@vike-data/vike-schema/schema'

export const usersAvatar = extendSchema('users', (t) => t.string('avatar').as('file').nullable())

export default [usersAvatar]
