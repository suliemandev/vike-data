// Same idiomatic wiring as examples/react, trimmed to the admin/auth/rbac surface: each
// capability is an extension installed via `extends` and configured with a sibling config key.
// The point of this example is that NONE of this app config changes between the in-memory twin
// and the real database -- only pages/+onCreateGlobalContext.js (the adapter) and the db/ scripts
// (migrations + seed) differ. Auth, admin and rbac are wired identically to examples/react.
import vikeReact from 'vike-react/config'
import authExt from 'vike-auth/react'
import adminExt from 'vike-admin/react'
import themesExt from 'vike-themes/react'
import layoutsExt from 'vike-layouts/react'
import emeraldExt from 'vike-theme-emerald/config'
import i18nExt from 'vike-i18n/react'
import rbacExt from 'vike-rbac/config'
import { defineTheme } from 'vike-themes'

// The app's own brand theme, contributed through the cumulative `themes` point exactly like a
// theme package (built-ins + emerald compose in).
const acme = defineTheme({
  name: 'acme',
  fonts: { sans: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, monospace' },
  radius: '4px',
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem' },
  light: {
    bg: '#fffdf7',
    surface: '#faf3e6',
    text: '#2a2016',
    muted: '#8a7a63',
    border: '#ece0cc',
    primary: '#b4530d',
    'primary-text': '#fffaf2',
  },
  dark: {
    bg: '#1a140d',
    surface: '#241c12',
    text: '#f3ead9',
    muted: '#b39e80',
    border: '#3a2e1d',
    primary: '#e0772a',
    'primary-text': '#1a140d',
  },
})

export default {
  extends: [vikeReact, authExt, adminExt, themesExt, layoutsExt, emeraldExt, i18nExt, rbacExt],

  title: 'vike-data on Postgres (pglite)',

  // i18n: vike-auth advertises fr/ar locale packs; declaring `locales` lets the vike-i18n plugin
  // include only what is installed. English ships inline with the components as the fallback.
  locales: ['en'],
  locale: 'en',

  // themes: pick the active brand + appearance mode (system follows the OS).
  appearance: 'system',
  theme: 'acme',
  themes: [acme],

  // rbac: the role a brand-new magic-link signup is granted on its first request. `member` is
  // seeded by db/seed.js; the resolver assigns it to any signed-in user who has no role yet.
  defaultRoles: ['member'],

  // layout: the app-shell + its slots. The auth /login page sets its own centered layout.
  layout: 'topbar',
  logo: '◆ Acme (Postgres)',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Admin', href: '/admin' },
    { label: 'Account', href: '/account', end: true },
    { label: 'Login', href: '/login', end: true },
  ],
}
