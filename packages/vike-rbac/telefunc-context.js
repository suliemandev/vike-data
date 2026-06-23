// The heart of the Telefunc seam (#110): resolve the Telefunc context's `user`
// from a request — the SAME user a page render sees, so the SAME can()/hasRole()
// guards both. Transport-agnostic: it takes a Web `Request` and returns the user,
// with NO telefunc import, so it is reused by both wirings below:
//   - telefunc-plugin.js   — the dev Vite plugin (serves /_telefunc itself)
//   - telefunc-middleware.js — the production universal middleware
//
// vike-auth/server re-reads the session cookie the same way onCreatePageContext
// does; vike-rbac's resolveAccess enriches it with the user's global roles +
// permissions. The result is the { id, email, name, roles, permissions } object
// the page enricher attaches, so a telefunction's requirePermission('x') runs
// exactly what the admin's canView: can(user, 'x') runs.
import { resolveSessionUser } from 'vike-auth/server'
import { resolveAccess } from './resolve.js'

/**
 * Resolve the RPC caller from a Web `Request`'s session cookie and enrich with
 * rbac access. Returns the user object Telefunc should put on its context, or
 * null for a signed-out caller (the telefunction's own guard decides what that
 * means — currentUser()/requirePermission() abort).
 */
export async function resolveRpcUser(request) {
  const base = await resolveSessionUser(request)
  if (!base) return null
  return { ...base, ...(await resolveAccess(base.id)) }
}
