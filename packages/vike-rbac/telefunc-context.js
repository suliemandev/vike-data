// The heart of the Telefunc seam (#110): resolve the Telefunc context's `user`
// from a request — the SAME user a page render sees, so the SAME can()/hasRole()
// guards both. Transport-agnostic: it takes a Web `Request` and returns the user,
// with NO telefunc import, so the single universal middleware that owns the RPC
// endpoint in dev and prod (telefunc-middleware.js, #128) reuses it.
//
// vike-auth/server re-reads the session cookie the same way onCreatePageContext
// does; vike-rbac's resolveAccessForUser enriches it with the user's global roles +
// permissions AND their org-scoped grants (reading the same orgRoleSource the page
// enricher remembers). The result is the { id, email, name, roles, permissions,
// orgRoles, orgPermissions } object the page enricher attaches, so a telefunction's
// requirePermission('x', { org }) runs exactly what the admin's canView: can(user, 'x',
// { org }) runs — page and RPC authorize identically (#235).
import { resolveSessionUser, resolveGuardUser } from 'vike-auth/server'
import { getGuard, DEFAULT_GUARD_NAME } from 'vike-auth/guards'
import { resolveAccessForUser } from './resolve.js'

// Which guard the RPC authenticates against (#291 / #207 P3). Mirrors the page's `rbacGuard`
// config, but the RPC runs its own lifecycle with no pageContext, so it reads the runtime env
// VIKE_RBAC_GUARD — the same config/env split vike-storage uses (storageGuard / VIKE_STORAGE_GUARD).
// Unset / 'default' / an unregistered name = the default subject, so the RPC reads the same session
// the page does, byte-for-byte today's behaviour.
function rbacGuard() {
  const name = process.env.VIKE_RBAC_GUARD
  if (!name || name === DEFAULT_GUARD_NAME) return null
  return getGuard(name)
}

/**
 * Resolve the RPC caller from a Web `Request`'s session cookie and enrich with
 * rbac access. Returns the user object Telefunc should put on its context, or
 * null for a signed-out caller (the telefunction's own guard decides what that
 * means — currentUser()/requirePermission() abort).
 */
export async function resolveRpcUser(request) {
  // Authenticate against the bound guard's own cookie + subject when set, else the default session.
  const guard = rbacGuard()
  const base = guard ? await resolveGuardUser(request, guard) : await resolveSessionUser(request)
  if (!base) return null
  // resolveAccessForUser folds in org grants (from the remembered orgRoleSource), so an
  // org-scoped guard — requirePermission('x', { org }) — authorizes the SAME on the RPC as
  // on the page. With no orgRoleSource configured this is the global roles/permissions (#235).
  return { ...base, ...(await resolveAccessForUser(base.id)) }
}
