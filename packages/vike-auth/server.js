// The server-tier seam: resolve the current user straight from a request's
// session cookie, OUTSIDE Vike's render lifecycle.
//
// onCreatePageContext (oncreate.js) already does this for the RENDERER, off
// `pageContext.headers.cookie`. But other server entry points need the same
// answer without a pageContext — most notably a Telefunc RPC handler, which
// runs as its own universal middleware and must put `{ user }` on the Telefunc
// context (Vike 0.4.259 does not bridge a middleware's context into pageContext,
// so the RPC path can't borrow the render path's `pageContext.user`). Factoring
// the cookie -> user step here keeps the two paths reading the same session the
// same way, instead of duplicating the lookup and risking drift.
import { auth } from './instance.js'
import { SESSION_COOKIE } from './constants.js'
import { parseCookies } from './cookie.js'

// Resolve a raw Cookie header string to the plain, serializable user view
// ({ id, email, name }) — the SAME shape onCreatePageContext exposes — or null.
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
