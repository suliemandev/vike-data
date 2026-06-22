// The /admin/* gate. A Vike `guard` hook (server-env by default) wired onto every
// admin page in react/+config.js. It reads the one field the vike-auth server tier
// resolves from the session cookie — `pageContext.user` — and bounces an anonymous
// request to /login. Per-RESOURCE auth (canView / canEdit) is finer and lives in the
// data hooks; this is the coarse "you must be signed in" fence.
import { redirect } from 'vike/abort'

export function adminGuard(pageContext) {
  if (!pageContext.user) {
    throw redirect('/login')
  }
}

export default adminGuard
