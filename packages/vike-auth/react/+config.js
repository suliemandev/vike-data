// The React binding for vike-auth, as a SUBPATH of the one package (no separate
// React package). The default export is the Vike config, so the app does
// `import auth from 'vike-auth/react'; extends: [auth]` (no /config) and gets the
// server tier, the auth strings, AND the auth pages in one install.
//
// It self-installs the headless core (vike-auth/config) and SHIPS its own pages via
// config.pages (vike#3356): install this extension and /login + /account appear,
// with no page file in the app.
//
// The i18n RUNTIME is still opt-in (the components ship English INLINE and render
// standalone with no t() provider). What this extension self-installs is only the
// HEADLESS i18n seam (vike-i18n/config) so it can ADVERTISE its language packs to
// the `localePacks` registry — see `localePacks` below. That advertisement is what
// makes zero-config `lang: [...]` work (#79): the app sets `lang` once and the
// vike-i18n Vite plugin pulls in vike-auth's matching catalogs with no per-pack
// import. The packs (vike-auth/fr, /ar) still also work the old manual way (their
// +config.js contributes to `messages`); the registry just lets the framework wire
// them automatically.
//
// Config-ONLY on purpose (Vike loads this in plain Node to resolve config): the JSX
// pages/components are referenced by pointer-import strings (loaded by Vite). The
// hook lives at vike-auth/react/hooks.
export default {
  name: 'vike-auth-react',
  extends: ['import:vike-auth/config:default', 'import:vike-i18n/config:default'],
  // The registry entry: a `{ <locale>: <catalog module specifier> }` map of this
  // extension's language packs. Plain DATA (just strings) contributed to the
  // cumulative `localePacks`, so it composes like `messages`/`schemas` with no
  // pointer-import resolution. The Vite plugin imports only the entries whose
  // locale is in the app's `lang`. English is the inline fallback, never a pack.
  localePacks: [{ fr: 'vike-auth/fr/messages', ar: 'vike-auth/ar/messages' }],
  // `loginRedirect`: where a signed-in visitor to /login is sent. The app owns
  // its post-login home — `loginRedirect: '/admin'` — defaulting to '/'. Single
  // value (last wins), available on pageContext.config in every environment so
  // the guard can read it server- and client-side.
  meta: {
    loginRedirect: { env: { config: true, server: true, client: true } },
    // Resolve the session cookie server-side ONLY. The cookie is HttpOnly so the
    // client can't read it; making this hook server-only means Vike round-trips
    // to the server on client-side navigation (re-resolving `user` for the new
    // page) instead of running it on the client where it would see no cookie and
    // null out `user`. Overrides the built-in isomorphic env { server, client }.
    onCreatePageContext: { env: { server: true } },
  },
  loginRedirect: '/',
  pages: [
    // The extension owns these routes. layout 'centered' gives /login the public
    // shell; /account inherits the app's default shell. The /login guard bounces
    // an already-signed-in visitor to `loginRedirect`.
    {
      route: '/login',
      Page: 'import:vike-auth/react/LoginPage:default',
      guard: 'import:vike-auth/react/loginGuard:guard',
      layout: 'centered',
    },
    { route: '/account', Page: 'import:vike-auth/react/AccountPage:default' },
  ],
}
