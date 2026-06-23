// The RBAC schema, declared once through the neutral DSL and contributed via
// vike-schema's cumulative `schemas` point (so it compiles to Prisma / Drizzle /
// the Rudder engine like every other extension's tables). The classic
// roles -> permissions model:
//
//   role_user        : which roles a user has        (user -> role,  many-to-many)
//   permission_role  : which permissions a role grants (role -> permission, m2m)
//
// can(user, permission) is the composition of the two: a user has a permission if
// any of their roles grants it. Row/resource scoping (ABAC) is intentionally NOT
// here — that is the separate `scope(user)` layer vike-admin already has (#105);
// org-scoped roles (multi-tenancy) are a later column on role_user, gated on the
// teams/org model. Kept deliberately flat for the first tier.
import { defineSchema } from '@vike-data/vike-schema/schema'

export const rbacSchemas = [
  defineSchema('roles', (t) => {
    t.uuid('id').primary()
    t.string('name').unique() // stable key, e.g. 'admin', 'member'
    t.string('label').nullable() // human label for an admin UI
    t.timestamps()
  }),
  defineSchema('permissions', (t) => {
    t.uuid('id').primary()
    t.string('name').unique() // stable key, e.g. 'users.view'
    t.string('label').nullable()
    t.timestamps()
  }),
  // A user's roles. FK into auth's `users` table (a cross-extension reference;
  // merge.js validates `users` exists). Deleting a user clears their grants.
  defineSchema('role_user', (t) => {
    t.uuid('id').primary()
    t.uuid('role_id').references('roles.id', { onDelete: 'cascade' })
    t.uuid('user_id').references('users.id', { onDelete: 'cascade' })
    t.timestamps()
  }),
  // A role's permissions.
  defineSchema('permission_role', (t) => {
    t.uuid('id').primary()
    t.uuid('permission_id').references('permissions.id', { onDelete: 'cascade' })
    t.uuid('role_id').references('roles.id', { onDelete: 'cascade' })
    t.timestamps()
  }),
]

export default rbacSchemas
