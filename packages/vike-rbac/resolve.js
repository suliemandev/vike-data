// Request-time resolution: enrich the signed-in user with their effective `roles`
// + `permissions`, so the sync can(user, ...) works everywhere downstream
// (vike-admin canView/canEdit, a page guard, a future Telefunc check).
//
// This is contributed to vike-auth's `resolveUser` seam (see vike-rbac/+config.js):
// auth runs it right after it resolves pageContext.user, on every page, before any
// guard/data hook reads it. That placement is deliberate — an extension's OWN
// onCreatePageContext runs before auth's (reverse-dependency order, so the base auth
// hook runs last and would clobber the enrichment), and a `guard` is single-per-page
// (vike-admin declares its own, shadowing a global one, so /admin would be missed).
// Auth owning the seam is the one spot that runs after user-resolution for all pages.
//
// Server-only: it reads the session-derived user and queries the DB. The seam is
// declared server-env in vike-auth; this also bails on the client defensively. On
// client-side navigation vike-auth's server-only hook round-trips to the server, so
// this re-runs there.
import { mergeSchemas } from '@vike-data/universal-schema'
import { createRepository, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { rbacSchemas } from './schema.js'
import { resolveUserAccess } from './index.js'
import { assignRoles } from './seed.js'

const KEY = Symbol.for('vike-rbac.db')

// Built lazily on first use and cached on globalThis, so the app's setAdapter(...)
// at server start is in place before the first request resolves the repository
// (mirrors vike-stripe's instance). Only the four RBAC tables are needed here.
// We cache the repository AND the underlying adapter: the repo backs the narrow
// finds below, while the raw adapter backs assignRoles (default-role-on-signup),
// and both must be the SAME backend so a freshly assigned role reads back.
function db() {
  if (!globalThis[KEY]) {
    const { tables } = mergeSchemas(rbacSchemas)
    const adapter = getAdapter() ?? createMemoryAdapter()
    globalThis[KEY] = { repo: createRepository({ tables }, adapter), adapter }
  }
  return globalThis[KEY]
}

export async function resolveAccessOnto(pageContext) {
  if (pageContext.isClientSide) return
  const user = pageContext.user
  if (!user?.id) return

  const { repo: d, adapter } = db()
  // Default-role-on-signup: a brand-new user (no roles yet) is granted the app's
  // configured `defaultRoles` on their first authenticated request, before we read
  // their access. Idempotent + opt-in (empty by default), so it's a no-op once they
  // hold a role or when no defaults are declared — see assignRoles in seed.js.
  let roleUser = await d.role_user.find({ user_id: user.id })
  if (roleUser.length === 0) {
    const defaults = [...new Set((pageContext.config?.defaultRoles || []).flat().filter(Boolean))]
    if (defaults.length) {
      await assignRoles(adapter, user.id, defaults)
      roleUser = await d.role_user.find({ user_id: user.id })
    }
  }

  // Org-scoped roles (#109): if the app pointed `orgRoleSource` at a table that holds
  // per-org role names (vike-teams `memberships`), read this user's rows and hand them
  // to the resolver as org grants. Read through the RAW adapter, not the repo: that
  // table belongs to another extension and isn't in rbac's merged schema. Off by
  // default, so a flat app does no extra read.
  const orgGrants = await readOrgGrants(adapter, pageContext.config?.orgRoleSource, user.id)

  // user -> roles -> permissions, in three narrow finds (equality + `in`).
  const roleIds = roleUser.map((r) => r.role_id)
  // Org grants reference roles by NAME, so widen the role/permission reads to cover
  // them too (a global role and an org role of the same name share the same grants).
  const orgRoleNames = [...new Set(orgGrants.map((g) => g.role).filter(Boolean))]
  const roles = await rolesForUser(d, roleIds, orgRoleNames)
  const allRoleIds = roles.map((r) => r.id)
  const permissionRole = allRoleIds.length ? await d.permission_role.find({ role_id: { in: allRoleIds } }) : []
  const permIds = permissionRole.map((pr) => pr.permission_id)
  const permissions = permIds.length ? await d.permissions.find({ id: { in: permIds } }) : []

  const access = resolveUserAccess(user.id, { roleUser, roles, permissionRole, permissions, orgGrants })
  // Mutate in place so the enrichment rides on the object auth already exposes via
  // passToClient (no separate passToClient needed) and the data hooks see it.
  user.roles = access.roles
  user.permissions = access.permissions
  user.orgRoles = access.orgRoles
  user.orgPermissions = access.orgPermissions
}

// Read a user's org-scoped role grants from the configured source table (vike-teams
// `memberships`). `source` is a table name or `{ table, roleColumn, orgColumn }`;
// undefined/empty -> no org grants. Normalized to the resolver's grant shape.
async function readOrgGrants(adapter, source, userId) {
  if (!source) return []
  const { table, roleColumn = 'role', orgColumn = 'organization_id' } =
    typeof source === 'string' ? { table: source } : source
  if (!table) return []
  const rows = await adapter.find(table, { user_id: userId })
  return rows.map((r) => ({ organization_id: r[orgColumn], role: r[roleColumn] }))
}

// Roles the user might exercise: their global role ids OR any org-grant role name. One
// `in` read per axis (skipping an empty axis), merged + de-duped by id.
async function rolesForUser(d, roleIds, roleNames) {
  const [byId, byName] = await Promise.all([
    roleIds.length ? d.roles.find({ id: { in: roleIds } }) : [],
    roleNames.length ? d.roles.find({ name: { in: roleNames } }) : [],
  ])
  const merged = new Map()
  for (const r of [...byId, ...byName]) merged.set(r.id, r)
  return [...merged.values()]
}

export default resolveAccessOnto
