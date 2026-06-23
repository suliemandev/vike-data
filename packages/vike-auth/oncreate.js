// The render-side half of the server tier, referenced from +config.js via
// `import:vike-auth/onCreatePageContext:default`. It resolves the session cookie
// to the current user and puts it on pageContext, so any page (and a future
// vike-auth/react UI) can read `pageContext.user` without knowing how auth works.
//
// Why this lives here and not in the middleware: Vike 0.4.259 does not bridge a
// universal middleware's returned context into pageContext, so the middleware
// can't hand `user` to the renderer. onCreatePageContext is the supported
// per-request pageContext enrichment hook, so the read happens here. (If Vike
// bridges middleware context -> pageContext, this collapses into the middleware.)
import { auth } from './instance.js'
import { SESSION_COOKIE } from './constants.js'
import { parseCookies } from './cookie.js'

export default async function onCreatePageContext(pageContext) {
  // Server-only resolution. The session cookie is HttpOnly, so it can only be read
  // server-side. Two things follow:
  //   1. vike-auth/react's +config.js pins this hook's env to `{ server: true }`,
  //      so Vike never runs it on the client. That both avoids clobbering the
  //      passToClient `user` on hydration AND makes Vike round-trip to the server
  //      on client-side navigation, re-resolving `user` for the new page (a client
  //      run could not, with no cookie) — which is what keeps the /login guard and
  //      useUser() correct after client-side nav.
  //   2. As defense in depth for any consumer that wires this hook WITHOUT that env
  //      override (e.g. a non-React binding), bail if it ever runs on the client:
  //      a client run has no cookie and would null out `user`.
  if (pageContext.isClientSide) return
  const token = parseCookies(pageContext.headers?.cookie)[SESSION_COOKIE]
  const resolved = token ? await auth.authenticate(token) : null
  // A plain, serializable view of the user — safe to expose to the client.
  pageContext.user = resolved
    ? { id: resolved.user.id, email: resolved.user.email, name: resolved.user.name }
    : null
}
