// The server-tier seam: resolve the current user straight from a request's
// session cookie, OUTSIDE Vike's render lifecycle.
//
// onCreatePageContext (oncreate.js) already does this for the RENDERER, off
// `pageContext.headers.cookie`. But other server entry points need the same
// answer without a pageContext, most notably a Telefunc RPC handler, which runs
// its OWN request lifecycle and never renders a page, so it has no pageContext to
// borrow the render path's `user` from (regardless of whether Vike bridges a
// middleware's context into pageContext on the render path). It must resolve the
// session itself and put `{ user }` on the Telefunc context. Factoring the
// cookie -> user step here keeps both paths reading the same session the same way,
// instead of duplicating the lookup and risking drift.
import { auth } from './instance.js'
import { SESSION_COOKIE } from './constants.js'
import { parseCookies } from './cookie.js'
import { getGuard, DEFAULT_GUARD_NAME } from './guards.js'
import { resolveSubject } from './subject.js'

// Resolve a raw Cookie header string to the plain, serializable user view
// ({ id, email, name }), the SAME shape onCreatePageContext exposes, or null.
export async function resolveSessionUserFromCookie(cookieHeader) {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE]
  if (!token) return null
  const resolved = await auth.authenticate(token)
  return resolved ? { id: resolved.user.id, email: resolved.user.email, name: resolved.user.name } : null
}

// Resolve the current user from a Web `Request` (its `cookie` header). Returns
// the plain user view or null when there is no valid session.
export function resolveSessionUser(request) {
  const cookieHeader = request?.headers?.get ? request.headers.get('cookie') : request?.headers?.cookie
  return resolveSessionUserFromCookie(cookieHeader)
}

// The guard-aware twin (the named-guards seam, #267 / #207 P3): resolve the user for a
// SPECIFIC guard descriptor — read THAT guard's own session cookie (`guard.cookieName`) and
// authenticate against its own subject tables (`guard.instance`), returning the same plain
// `{ id, email, name }` view, or null. Passing the default guard (getDefaultGuard()) is
// exactly resolveSessionUser; passing a named guard binds resolution to that audience.
// A downstream extension that owns rows by a non-default subject (vike-storage's
// `storageGuard`, #278) resolves the owner through this, so its notion of "the signed-in
// owner" can't drift from vike-auth's.
export async function resolveGuardUserFromCookie(cookieHeader, guard) {
  if (!guard) return null
  const token = parseCookies(cookieHeader)[guard.cookieName]
  if (!token) return null
  const resolved = await guard.instance.authenticate(token)
  return resolved ? { id: resolved.user.id, email: resolved.user.email, name: resolved.user.name } : null
}

// The `Request` form of resolveGuardUserFromCookie (reads its `cookie` header), mirroring
// resolveSessionUser.
export function resolveGuardUser(request, guard) {
  const cookieHeader = request?.headers?.get ? request.headers.get('cookie') : request?.headers?.cookie
  return resolveGuardUserFromCookie(cookieHeader, guard)
}

// The by-NAME convenience the downstream owned-row extensions (vike-storage's `storageGuard`,
// vike-notifications' `notificationsGuard`, #278 / #279 / #207 P3) resolve a request's user
// through: given the guard NAME an app bound the extension to, resolve the user from THAT guard's
// session cookie + subject, or from the default subject when the name is empty / 'default' / an
// unregistered guard. The extension passes its own already-read env value (e.g.
// `process.env.VIKE_STORAGE_GUARD`), so vike-auth stays env-free; this just folds the
// name -> guard -> user step the extensions otherwise re-derive identically.
export function resolveGuardedUser(request, guardName) {
  if (!guardName || guardName === DEFAULT_GUARD_NAME) return resolveSessionUser(request)
  const guard = getGuard(guardName)
  return guard ? resolveGuardUser(request, guard) : resolveSessionUser(request)
}

// The subject TABLE a request's user lives in, by guard name — the named guard's subject table, or
// the default `users` when the name is empty / 'default' / unregistered. The owned-row extensions
// use it to load the full subject row when the owner id lives on a column other than `.id` (the
// #250 owner binding), and for bare-id subject hydration. Same env-free, by-name shape as
// resolveGuardedUser.
export function resolveGuardSubjectTable(guardName) {
  if (!guardName || guardName === DEFAULT_GUARD_NAME) return resolveSubject().users
  const guard = getGuard(guardName)
  return guard ? guard.subject.users : resolveSubject().users
}
