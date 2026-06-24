// The render-side half of the server tier, referenced from +config.js via
// `import:vike-auth/onCreatePageContext:default`. It resolves the session cookie
// to the current user and puts it on pageContext, so any page (and a future
// vike-auth/react UI) can read `pageContext.user` without knowing how auth works.
//
// Why this lives here and not in the middleware: onCreatePageContext is the
// supported per-request pageContext enrichment hook AND, more importantly, it is
// where the cumulative `resolveUser` enricher seam below has to run (after auth
// resolves `user`, before any guard/data hook, in dependency order). Vike can now
// bridge a context-returning universal middleware into pageContext (vikejs/vike, the
// `+server` path), but that would NOT replace this hook: a middleware can't host the
// ordered enricher seam, so user resolution stays unified here with the enrichers.
import { resolveSessionUserFromCookie } from './server.js'

export default async function onCreatePageContext(pageContext) {
  // Server-only resolution. The session cookie is HttpOnly, so it can only be read
  // server-side. Two things follow:
  //   1. vike-auth/react's +config.js pins this hook's env to `{ server: true }`,
  //      so Vike never runs it on the client. That both avoids clobbering the
  //      passToClient `user` on hydration AND makes Vike round-trip to the server
  //      on client-side navigation, re-resolving `user` for the new page (a client
  //      run could not, with no cookie), which is what keeps the /login guard and
  //      useUser() correct after client-side nav.
  //   2. As defense in depth for any consumer that wires this hook WITHOUT that env
  //      override (e.g. a non-React binding), bail if it ever runs on the client:
  //      a client run has no cookie and would null out `user`.
  if (pageContext.isClientSide) return
  // A plain, serializable view of the user ({ id, email, name }), safe to expose
  // to the client. Same cookie -> user resolution a Telefunc RPC handler reuses
  // via vike-auth/server, so both read the session identically.
  pageContext.user = await resolveSessionUserFromCookie(pageContext.headers?.cookie)

  // USER-ENRICHER SEAM. Other extensions need to add to the resolved user (e.g.
  // vike-rbac attaches roles/permissions) for EVERY page. They can't do it in their
  // own onCreatePageContext: Vike runs those in reverse-dependency order, so this
  // base hook runs LAST and would clobber their work; and a `guard` is single-per-page,
  // so a page that declares its own (vike-admin) shadows a global one. So auth, which
  // owns `user`, runs cumulative `resolveUser` enrichers right here, right after it
  // resolves the user and before any guard/data hook reads it. Each enricher gets the
  // pageContext and mutates pageContext.user in place. Server-only, like this hook.
  if (pageContext.user) {
    const enrichers = (pageContext.config?.resolveUser || []).flat().filter(Boolean)
    for (const enrich of enrichers) await enrich(pageContext)
  }
}
