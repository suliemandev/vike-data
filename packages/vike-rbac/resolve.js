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
import { DEFAULT_GUARD_NAME } from 'vike-auth/guards'
import { rbacSchemas } from './schema.js'
import { resolveUserAccess } from './index.js'
import { assignRoles } from './seed.js'

const KEY = Symbol.for('vike-rbac.db')
const SOURCE_KEY = Symbol.for('vike-rbac.orgRoleSource')

// The configured `orgRoleSource`, remembered on globalThis. The page enricher reads it
// from `pageContext.config` on every render and records it here; the Telefunc RPC seam has
// NO pageContext, so it reads the SAME source from here to load the SAME org grants. Without
// this, org-scoped checks resolved on the RPC path but with no grants, so `can(user, x,
// { org })` always denied over RPC (page vs RPC divergence). An app/server can also set it
// explicitly at startup for an RPC that fires before any page render.
export function setOrgRoleSource(source) {
  globalThis[SOURCE_KEY] = source || null
}
function getOrgRoleSource() {
  return globalThis[SOURCE_KEY] || null
}

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
  // Which audience does rbac enrich? Default = the default guard's `pageContext.user`. A named
  // `rbacGuard` (#291 / #207 P3) enriches THAT guard's resolved user instead — the object the
  // vike-auth guards render hook (guards-oncreate) put on `pageContext.guards[name].user`. That
  // hook runs BEFORE this enricher (the resolveUser seam runs last, after every other
  // onCreatePageContext hook), so the guard user is already resolved here; we enrich it IN PLACE so
  // the same object the page reads for can() carries the roles/permissions. Unset / 'default' / an
  // unresolved guard falls back to the default user — byte-for-byte today's single-subject path.
  const guardName = pageContext.config?.rbacGuard
  const user =
    guardName && guardName !== DEFAULT_GUARD_NAME ? pageContext.guards?.[guardName]?.user : pageContext.user
  if (!user?.id) return

  const { adapter } = db()
  // Default-role-on-signup: a brand-new user (no roles yet) is granted the app's
  // configured `defaultRoles` on their first authenticated request, before we read
  // their access. Idempotent + opt-in (empty by default), so it's a no-op once they
  // hold a role or when no defaults are declared — see assignRoles in seed.js.
  const existing = await adapter.find('role_user', { user_id: user.id })
  if (existing.length === 0) {
    const defaults = [...new Set((pageContext.config?.defaultRoles || []).flat().filter(Boolean))]
    if (defaults.length) await assignRoles(adapter, user.id, defaults)
  }

  // Org-scoped roles (#109): if the app pointed `orgRoleSource` at a table that holds
  // per-org role names (vike-teams `memberships`), read this user's rows and hand them
  // to the resolver as org grants. Read through the RAW adapter, not the repo: that
  // table belongs to another extension and isn't in rbac's merged schema. Off by
  // default, so a flat app does no extra read. Remember the source so the RPC seam,
  // which has no pageContext, resolves the same org grants (#235).
  const source = pageContext.config?.orgRoleSource
  if (source) setOrgRoleSource(source)
  const orgGrants = await readOrgGrants(adapter, source, user.id)

  const access = await resolveAccess(user.id, { orgGrants })
  // Mutate in place so the enrichment rides on the object auth already exposes via
  // passToClient (no separate passToClient needed) and the data hooks see it.
  user.roles = access.roles
  user.permissions = access.permissions
  user.orgRoles = access.orgRoles
  user.orgPermissions = access.orgPermissions
}

/**
 * Resolve a user's effective access by user id alone — the three narrow finds
 * (user -> roles -> permissions) plus the pure resolver. Shared by the page
 * enricher above AND the Telefunc RPC seam (telefunc-middleware.js), which has a
 * user id from the session cookie but no pageContext to enrich. Pass `orgGrants`
 * (from a teams `memberships` read) to fold in org-scoped roles (#109); without
 * them you get the GLOBAL roles/permissions, which is the app-wide `can()` data.
 *
 * Returns `{ roles, permissions, orgRoles, orgPermissions }` — the same shape the
 * enricher attaches to the user, so the same sync `can(user, permission)` works
 * whether the user came from a page render or an RPC call.
 */
export async function resolveAccess(userId, { orgGrants = [] } = {}) {
  if (!userId) return { roles: [], permissions: [], orgRoles: {}, orgPermissions: {} }
  const { repo: d } = db()
  const roleUser = await d.role_user.find({ user_id: userId })

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

  return resolveUserAccess(userId, { roleUser, roles, permissionRole, permissions, orgGrants })
}

/**
 * Resolve a user's effective access by user id INCLUDING org grants, reading the org
 * source the page enricher remembered (setOrgRoleSource). The Telefunc RPC seam uses this:
 * it has a user id from the session cookie but no pageContext to read `orgRoleSource` from,
 * so without it org-scoped RPC guards always denied. With `orgRoleSource` unset this is
 * exactly `resolveAccess(userId)` (global roles/permissions only), so a flat app is unchanged.
 */
export async function resolveAccessForUser(userId) {
  if (!userId) return resolveAccess(userId)
  const { adapter } = db()
  const orgGrants = await readOrgGrants(adapter, getOrgRoleSource(), userId)
  return resolveAccess(userId, { orgGrants })
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
