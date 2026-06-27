// The permission set this app advertises into vike-rbac's cumulative registry. One source of
// truth shared by the standalone seed (db/seed.js) and the dev-convenience boot seed
// (pages/+onCreateGlobalContext.js): seedRbac DERIVES the `admin` role, the permissions, and the
// role->permission grants from it. `member` grants nothing, so it is a standalone role passed for
// default-role-on-signup.
import { definePermissions } from 'vike-rbac'

export const appPermissions = definePermissions([
  { name: 'users.view', label: 'View users', roles: ['admin'] },
  { name: 'users.edit', label: 'Edit users', roles: ['admin'] },
])

export const standaloneRoles = ['member']
