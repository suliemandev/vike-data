// Everything is wired the SAME idiomatic way as the other extensions (auth,
// billing): the app installs each via `extends` and configures it with a sibling
// config key. No ThemeProvider, no shell wiring, no themes.js — those are the
// extensions' job.
//
//   - themes:  install vike-themes/react + the emerald theme PACKAGE; pick the
//              active one with `theme`. The app's OWN brand theme is contributed
//              through the same cumulative `themes` point (customization).
//   - layout:  install vike-layouts/react; pick the shell with `layout`, fill the
//              slots with `logo`/`nav`. The auth /login page sets its own layout.
//   - auth:    install vike-auth/react — one import brings the server tier, the auth
//              strings, AND the /login + /account pages (the extension owns them).
import vikeReact from 'vike-react/config'
import authExt from 'vike-auth/react'
import adminExt from 'vike-admin/react'
import themesExt from 'vike-themes/react'
import layoutsExt from 'vike-layouts/react'
import emeraldExt from 'vike-theme-emerald/config'
import i18nExt from 'vike-i18n/react'
import toolbarExt from 'vike-toolbar/react'
import rbacExt from 'vike-rbac/config'
import { defineTheme } from 'vike-themes'
import { appMessages } from '../messages.js'

// (customization) the app's own brand theme — one brand carrying BOTH modes.
// Override only the tokens you want; contributed via the cumulative `themes`
// config below, exactly like a theme package.
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
  extends: [vikeReact, authExt, adminExt, themesExt, toolbarExt, layoutsExt, emeraldExt, i18nExt, rbacExt],
  title: 'vike-data React UI tier',

  // admin: install vike-admin/react — one import brings the /admin/* pages and the
  // cumulative `adminResources` seam. The app's `users` resource is contributed from the
  // sibling +adminResources.js file (resources carry functions — canView/canEdit — so
  // Vike pointer-imports the file rather than serializing them into the config).

  // two axes: which brand, and which mode (system follows the OS).
  appearance: 'system', // 'system' | 'light' | 'dark'
  theme: 'acme', // active brand, from the cumulative `themes` registry
  themes: [acme], // the app contributes its own brand (built-ins + emerald compose in)

  // i18n: declare the app's languages ONCE with `locales` (#79). The vike-i18n Vite
  // plugin reads it + every installed extension's advertised `localePacks` and
  // auto-includes the matching catalogs (here: vike-auth/fr + vike-auth/ar), with
  // NO per-pack import or `extends`; drop a locale from `locales` and it tree-shakes
  // out of the bundle. `locale` is the default active locale; English ships INLINE
  // with the components as the universal fallback (never a pack). The app's own
  // strings still compose through the cumulative `messages` point. `ar` flips the
  // document to RTL automatically (#54): vike-i18n drives <html lang>/<html dir>
  // off the active locale.
  locales: ['en', 'fr', 'ar'],
  locale: 'en',
  messages: [appMessages],

  // rbac: the role a brand-new magic-link signup is granted on their first request
  // (vike-rbac's default-role-on-signup seam, #111). The `member` role is seeded in
  // +onCreateGlobalContext; the resolver assigns it to any signed-in user who has no
  // role yet, so a fresh account isn't permission-less.
  defaultRoles: ['member'],

  // rbac + Telefunc seam (#110): guarded RPCs. The telefunction guards (requirePermission)
  // run the SAME can() as the admin's canView, because every call gets the signed-in,
  // role-enriched user on the Telefunc context. Under `vite dev` that context is provided
  // by vike-rbac/telefunc-plugin (wired in vite.config). This `middleware` is the
  // PRODUCTION transport (a server that mounts universal middlewares uses it); it's inert
  // under `vite dev`, where the Vite plugin serves /_telefunc first. See pages/rpc-demo.
  middleware: ['import:vike-rbac/telefunc-middleware:default'],

  // layout: pick the app-shell + fill its slots. The auth /login page sets centered.
  layout: 'topbar',
  logo: '◆ Acme',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Admin', href: '/admin' },
    { label: 'RPC', href: '/rpc-demo' },
    { label: 'Account', href: '/account' },
    { label: 'Login', href: '/login' },
  ],
}
