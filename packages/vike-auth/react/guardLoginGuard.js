// Guard for a named guard's login page: a visitor already signed into THIS guard has no
// business on its sign-in form, so bounce them to the app's post-login home. The
// multi-guard twin of loginGuard.js — it checks `pageContext.guards[<authGuard>].user`
// (this guard's session) rather than the default `pageContext.user`, so being signed into
// the `client` guard does NOT bounce you off the `admin` login.
//
// `authGuard` is the per-page config the app sets on each guard login route; the guard
// users are resolved by guards-oncreate.js into pageContext.guards. Referenced from the
// app's page entry by pointer import, like the default loginGuard.
import { redirect } from 'vike/abort'
import { sanitizeNext } from '../safe-redirect.js'

export function guard(pageContext) {
  const name = pageContext.config?.authGuard
  const user = name ? pageContext.guards?.[name]?.user : null
  if (!user) return // not signed into this guard: render the form
  const next = sanitizeNext(pageContext.urlParsed?.search?.next)
  throw redirect(next || pageContext.config?.loginRedirect || '/')
}
