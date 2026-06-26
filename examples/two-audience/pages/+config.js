// Phase 0 of the two-audience reference app (epic #255). The skeleton: ONE audience
// (vike-auth's default `User`/`users` guard, used as-is) composed with the minimal
// UI tier so the harness builds, runs, and renders a real login. The second guard,
// org ownership, and the Vue twin land in later phases; no vike-auth changes here.
//
// Everything is wired the same idiomatic way as the other demos: install each
// extension via `extends` and configure it with a sibling config key.
//
//   - auth:    install vike-auth/react — one import brings the server tier (memory
//              adapter below), the auth strings, AND the /login + /account pages
//              (the extension owns them). This is the keystone the guard work builds on.
//   - themes:  install vike-themes/react + the emerald theme PACKAGE; pick the active
//              one with `theme`, and the appearance axis with `appearance`.
//   - layout:  install vike-layouts/react; pick the app shell with `layout` and fill
//              its slots with `logo`/`nav`. The auth /login page sets its own
//              `centered` layout, which is why vike-layouts must be installed.
import vikeReact from 'vike-react/config'
import authExt from 'vike-auth/react'
import themesExt from 'vike-themes/react'
import layoutsExt from 'vike-layouts/react'
import emeraldExt from 'vike-theme-emerald/config'

export default {
  extends: [vikeReact, authExt, themesExt, layoutsExt, emeraldExt],

  // themes: two axes — which brand (`theme`, from the cumulative themes registry; the
  // emerald package contributes 'emerald'), and which mode (`appearance`: 'system'
  // follows the OS, flash-free).
  appearance: 'system',
  theme: 'emerald',

  // layout: pick the app shell + fill its slots. The auth /login page overrides this
  // with its own `centered` shell.
  layout: 'topbar',
  logo: '◈ Two Audience',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Account', href: '/account' },
    { label: 'Login', href: '/login' },
  ],
}
