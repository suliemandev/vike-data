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
import { resolveSubject } from 'vike-auth/subject'
import { getGuard, DEFAULT_GUARD_NAME } from 'vike-auth/guards'

// Build the four RBAC tables against a given subject table, so `role_user.user_id`
// follows BOTH a renamed default subject (VIKE_AUTH_SUBJECT_TABLE, PR #215) AND a
// named guard binding (#291 / #207 P3). Only `role_user` references the subject; the
// other three are subject-independent. `usersTable` defaults to the resolved default
// subject, so the zero-config app is byte-for-byte unchanged. Tests call this with an
// explicit table without touching env.
export function rbacSchemasFor(usersTable = resolveSubject().users) {
  return [
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
    // A user's roles. FK into auth's subject table (a cross-extension reference;
    // merge.js validates the table exists). Deleting a user clears their grants.
    defineSchema('role_user', (t) => {
      t.uuid('id').primary()
      t.uuid('role_id').references('roles.id', { onDelete: 'cascade' })
      t.uuid('user_id').references(`${usersTable}.id`, { onDelete: 'cascade' })
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
}

// Resolved once at import against the DEFAULT subject — the array resolve.js builds its
// own RBAC-tables repo from, and the value tests read. Byte-for-byte the previous inline
// schema when no subject override / guard binding is set.
export const rbacSchemas = rbacSchemasFor()

// The config-aware `schemas` contribution (#291 / #207 P3). `config.rbacGuard` names the
// guard whose subject OWNS the role grants: defaults to the DEFAULT guard (the env-configured
// `users`), so no `rbacGuard` = today's table, and `rbacGuard: 'admin'` points `role_user.user_id`
// at `admins`. An unknown / not-yet-registered guard name falls back to the default subject rather
// than mint an FK to a table no guard owns. The runtime user resolution follows the same guard via
// VIKE_RBAC_GUARD (resolve.js / the Telefunc seam). Vike hands this the resolved config
// (resolveSchemas(config.schemas, config)), the same build-time seam vike-storage's
// `uploadsSchemas(config)` uses.
export function rbacSchemasFromConfig(config) {
  const guardName = config?.rbacGuard || DEFAULT_GUARD_NAME
  const guard = getGuard(guardName)
  return rbacSchemasFor(guard ? guard.subject.users : resolveSubject().users)
}

export default rbacSchemas
