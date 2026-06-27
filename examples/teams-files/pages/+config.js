// The org-owned uploads reference app (#284 - the UI proof for #250, part of epic #255).
//
// Where the two-audience app demonstrates the GUARD axis (#278: which subject TABLE owns an
// upload - `admins` vs the default `users`), this app demonstrates the orthogonal OWNER-ARITY
// axis (#250: what KIND of thing owns an upload - an individual user vs a whole organization).
// It runs the plain DEFAULT user guard (no named guards) so the only moving part on show is
// ownership arity.
//
// Everything is wired the same idiomatic way as the other demos: install each extension via
// `extends` and configure it with a sibling config key.
//
//   - auth:    install vike-auth/react — the keystone server tier + the default /login +
//              /account pages (the default `User`/`users` guard, used as-is).
//   - teams:   install vike-teams/config — the Stem composition proof. It self-installs
//              vike-auth, contributes `organizations` + `memberships` + `invitations`, and ADDS
//              `current_organization_id` to auth's `users` table. That column is the user's
//              active org, and it is what storage reads to scope an upload to the org.
//   - storage: install vike-storage and BIND ownership to the ORGANIZATION with `storageOwner`
//              (#250). The build-time half rewrites the `uploads` owner FK from `user_id` ->
//              `organization_id` against the `organizations` table (the kit `resolveOwner`
//              contract). The runtime half (VIKE_STORAGE_OWNER_COLUMN / _FROM, set in
//              +onCreateGlobalContext.js) resolves the owner id from the signed-in user's
//              `current_organization_id` instead of their own id. Omit `storageOwner` and the
//              default user-owned path is byte-for-byte unchanged.
//   - themes:  install vike-themes/react + the emerald theme PACKAGE; pick the active one with
//              `theme`, and the appearance axis with `appearance`.
//   - layout:  install vike-layouts/react; pick the app shell with `layout` and fill its slots
//              with `logo`/`nav`. The login page sets its own `centered` shell.
import vikeReact from 'vike-react/config'
import authExt from 'vike-auth/react'
import teamsExt from 'vike-teams/config'
import storageExt from 'vike-storage/config'
import themesExt from 'vike-themes/react'
import layoutsExt from 'vike-layouts/react'
import emeraldExt from 'vike-theme-emerald/config'

export default {
  extends: [vikeReact, authExt, teamsExt, storageExt, themesExt, layoutsExt, emeraldExt],

  // storage: bind ownership to the organization (#250). `table` rebinds the `uploads` owner FK
  // to `organizations`; `column` names the FK column (`organization_id`). The matching runtime
  // env (VIKE_STORAGE_OWNER_COLUMN = the column here; VIKE_STORAGE_OWNER_FROM = the field on the
  // user row that holds the org id) lives in +onCreateGlobalContext.js — the same config/env
  // split vike-storage shares with vike-stripe's `segment`/`BILLING_SEGMENT`.
  storageOwner: { table: 'organizations', column: 'organization_id' },

  // themes: two axes — which brand (`theme`, from the cumulative themes registry; the emerald
  // package contributes 'emerald'), and which mode (`appearance`: 'system' follows the OS,
  // flash-free).
  appearance: 'system',
  theme: 'emerald',

  // layout: pick the app shell + fill its slots. The login page overrides this with its own
  // `centered` shell.
  layout: 'topbar',
  logo: '◈ Teams + Files',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Sign in', href: '/login' },
  ],
}
