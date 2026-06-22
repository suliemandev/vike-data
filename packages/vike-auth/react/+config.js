// The React binding for vike-auth, as a SUBPATH of the one package (no separate
// React package). The default export is the Vike config, so the app does
// `import auth from 'vike-auth/react'; extends: [auth]` (no /config) and gets the
// server tier, the auth strings, AND the auth pages in one install.
//
// It self-installs the headless core (vike-auth/config) and vike-i18n (for the
// cumulative messages), and SHIPS its own pages via config.pages (vike#3356):
// install this extension and /login + /account appear, with no page file in the app.
//
// Config-ONLY on purpose (Vike loads this in plain Node to resolve config): it
// imports only `.js` (messages), and the JSX pages/components are referenced by
// pointer-import strings (loaded by Vite). The hook lives at vike-auth/react/hooks.
import { authMessages } from './messages.js'

export default {
  name: 'vike-auth-react',
  extends: ['import:vike-auth/config:default', 'import:vike-i18n/config:default'],
  messages: [authMessages],
  pages: [
    // The extension owns these routes. layout 'centered' gives /login the public
    // shell; /account inherits the app's default shell.
    { route: '/login', Page: 'import:vike-auth/react/LoginPage:default', layout: 'centered' },
    { route: '/account', Page: 'import:vike-auth/react/AccountPage:default' },
  ],
}
