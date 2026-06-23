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

  // user -> roles -> permissions, in three narrow finds (equality + `in`).
  const roleIds = roleUser.map((r) => r.role_id)
  const roles = roleIds.length ? await d.roles.find({ id: { in: roleIds } }) : []
  const permissionRole = roleIds.length ? await d.permission_role.find({ role_id: { in: roleIds } }) : []
  const permIds = permissionRole.map((pr) => pr.permission_id)
  const permissions = permIds.length ? await d.permissions.find({ id: { in: permIds } }) : []

  const access = resolveUserAccess(user.id, { roleUser, roles, permissionRole, permissions })
  // Mutate in place so the enrichment rides on the object auth already exposes via
  // passToClient (no separate passToClient needed) and the data hooks see it.
  user.roles = access.roles
  user.permissions = access.permissions
}

export default resolveAccessOnto
