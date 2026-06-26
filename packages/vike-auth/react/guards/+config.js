// The opt-in GUARDS config (#267) — install this in addition to vike-auth/react to turn on
// named, multi-instance guards. An app that doesn't install it keeps the byte-for-byte
// single-subject default; this is purely additive.
//
//   import authGuards from 'vike-auth/react/guards'
//   extends: [vikeReact, authExt, authGuards]
//
// It wires the three guard seams:
//   - `middleware`: the guards dispatcher (guards-middleware.js) owning every
//     `/<name>-auth/*` endpoint + per-guard session cookie. Inert until a guard is declared.
//   - `onCreatePageContext`: the guards render hook (guards-oncreate.js) resolving each
//     guard's cookie to `pageContext.guards[name].user`. Server-only (the cookies are
//     HttpOnly); added ALONGSIDE the default user hook, not replacing it.
//   - `passToClient`: expose the resolved `guards` map so the client reads the same value
//     after hydration (the UI shows who's signed into which guard).
//
// The app still declares the guards themselves with `defineGuard` (guards.js) and owns the
// per-guard login ROUTES, pointing each at vike-auth/react/GuardLoginPage (the extension
// owns the login UI; the app owns the URL). Each guard login page entry sets `authGuard:
// '<name>'`, read via the `authGuard` meta below.
export default {
  name: 'vike-auth-guards-react',
  middleware: 'import:vike-auth/guards-middleware:default',
  onCreatePageContext: 'import:vike-auth/guards-oncreate:default',
  meta: {
    // Server-only, same rationale as the default user hook: the guard cookies are HttpOnly,
    // so resolution only works server-side, and Vike round-trips on client-side nav to
    // re-resolve for the new page instead of nulling guards out on the client.
    onCreatePageContext: { env: { server: true } },
    // Per-page: which guard a login route belongs to. The app sets `authGuard: 'admin'` on
    // its `/admin/login` page entry; GuardLoginPage + guardLoginGuard read it. Available in
    // every env (config/server/client) so the page renders and the guard runs both sides.
    authGuard: { env: { config: true, server: true, client: true } },
  },
  // Cumulative — merges with the host's other passToClient keys (incl. the default `user`).
  passToClient: ['guards'],
}
