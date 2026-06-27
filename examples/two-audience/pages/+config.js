// Phase 1 of the two-audience reference app (epic #255 / #267). TWO independent auth
// audiences in one app: a `staff` admin guard over the `admins` table and a `client` guard
// over `clients`, each with its own login page, session cookie, and endpoint namespace.
// The default user guard stays available and byte-for-byte unchanged; the guards are purely
// additive (named guards are opt-in).
//
// Everything is wired the same idiomatic way as the other demos: install each extension via
// `extends` and configure it with a sibling config key.
//
//   - auth:    install vike-auth/react — the keystone server tier + the default /login +
//              /account pages (the default `User`/`users` guard, used as-is).
//   - guards:  install vike-auth/react/guards (#267) — the opt-in named-guards tier: the
//              dispatcher middleware owning every `/<name>-auth/*` endpoint, the render hook
//              resolving `pageContext.guards[name].user`, and the `authGuard` page meta. The
//              guards themselves are declared in ../guards.js with defineGuard.
//   - themes:  install vike-themes/react + the emerald theme PACKAGE; pick the active one
//              with `theme`, and the appearance axis with `appearance`.
//   - layout:  install vike-layouts/react; pick the app shell with `layout` and fill its
//              slots with `logo`/`nav`. The login pages set their own `centered` shell.
import vikeReact from 'vike-react/config'
import authExt from 'vike-auth/react'
import authGuardsExt from 'vike-auth/react/guards'
import storageExt from 'vike-storage/config'
import themesExt from 'vike-themes/react'
import layoutsExt from 'vike-layouts/react'
import emeraldExt from 'vike-theme-emerald/config'
import { guards } from '../guards.js'

export default {
  extends: [vikeReact, authExt, authGuardsExt, storageExt, themesExt, layoutsExt, emeraldExt],

  // guards: contribute each guard's tables (`admins` + `admin_sessions` + ..., and the
  // client trio) to the cumulative `schemas` point — they merge + derive alongside the
  // default's `users`/`sessions`/`login_tokens`, exactly like a second extension's tables.
  schemas: guards.flatMap((g) => g.schemas),

  // guards: the app owns the per-guard login ROUTES (the extension can't statically know
  // the guard names), but points each at vike-auth's GuardLoginPage component — vike-auth
  // owns the login UI. `authGuard` tells the page + its guard which audience this route
  // belongs to (so the form posts to `/admin-auth/request` and bounces an already-signed-in
  // admin). `centered` gives the public login shell.
  pages: guards.map((g) => ({
    route: `/${g.name}/login`,
    Page: 'import:vike-auth/react/GuardLoginPage:default',
    guard: 'import:vike-auth/react/guardLoginGuard:guard',
    layout: 'centered',
    authGuard: g.name,
  })),

  // storage: install vike-storage (adds the `uploads` table + the /uploads endpoint) and
  // BIND it to the staff audience with `storageGuard` (#278 / #207 P3). This is the downstream
  // "which subject" seam: the `uploads.user_id` FK now targets the admin guard's subject
  // (`admins`) instead of the default `users`, and the upload endpoint resolves the owner from
  // the admin session cookie. The runtime half reads the guard from VIKE_STORAGE_GUARD, set in
  // +onCreateGlobalContext.js (the config/env split vike-storage shares with vike-stripe's
  // `segment`/`BILLING_SEGMENT`). Unset = the default `users` subject, byte-for-byte. The home
  // page shows a staff-only uploader and lists the signed-in admin's own files.
  storageGuard: 'admin',

  // themes: two axes — which brand (`theme`, from the cumulative themes registry; the
  // emerald package contributes 'emerald'), and which mode (`appearance`: 'system'
  // follows the OS, flash-free).
  appearance: 'system',
  theme: 'emerald',

  // layout: pick the app shell + fill its slots. The login pages override this with their
  // own `centered` shell.
  layout: 'topbar',
  logo: '◈ Two Audience',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Staff login', href: '/admin/login' },
    { label: 'Client login', href: '/client/login' },
  ],
}
