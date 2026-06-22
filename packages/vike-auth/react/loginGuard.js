// Guard for the extension's /login page: a signed-in visitor has no business on
// the sign-in form, so bounce them to the app's post-login home. The destination
// is the `loginRedirect` config key (declared in +config.js, default '/'), so the
// app sets where signed-in users belong — `loginRedirect: '/admin'`.
//
// `user` is resolved by the server tier (onCreatePageContext) and passed to the
// client, so this works on first load (server-side redirect) and on client-side
// navigation alike. Referenced from +config.js by pointer import, like the pages.
import { redirect } from 'vike/abort'

export function guard(pageContext) {
  if (!pageContext.user) return // not signed in: render the form
  throw redirect(pageContext.config?.loginRedirect || '/')
}
