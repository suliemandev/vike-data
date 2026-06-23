// The React binding for vike-auth, as a SUBPATH of the one package (no separate
// React package). The default export is the Vike config, so the app does
// `import auth from 'vike-auth/react'; extends: [auth]` (no /config) and gets the
// server tier, the auth strings, AND the auth pages in one install.
//
// It self-installs the headless core (vike-auth/config) and SHIPS its own pages via
// config.pages (vike#3356): install this extension and /login + /account appear,
// with no page file in the app.
//
// i18n is OPT-IN, not self-installed here: the components ship their English INLINE
// (passed to useTranslation) and render standalone with no i18n runtime. Other
// languages are SUBPATHS (vike-auth/fr, /ar) that the app extends alongside this;
// they contribute their catalog to the cumulative `messages` and bring vike-i18n.
//
// Config-ONLY on purpose (Vike loads this in plain Node to resolve config): the JSX
// pages/components are referenced by pointer-import strings (loaded by Vite). The
// hook lives at vike-auth/react/hooks.
export default {
  name: 'vike-auth-react',
  extends: ['import:vike-auth/config:default'],
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
