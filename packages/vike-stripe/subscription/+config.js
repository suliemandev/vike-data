// vike-stripe/subscription — the recurring-subscription billing MODEL, installed the
// idiomatic Vike way (the subpath default export IS the config; no `/config`):
//
//   import subscription from 'vike-stripe/subscription'
//   export default { extends: [subscription], segment: 'b2b' }
//
// The subpath picks the MODEL (recurring); `segment` picks WHO you bill — 'b2b'
// (the subject is an organization) or 'b2c' (the subject is an individual user).
// The two axes are orthogonal: model x segment covers all four combinations.
//
// It declares `segment` and computes its schema from it (a function wired as a
// pointer-import, since a runtime config value can't be an inline function), so the
// subject FK lands in `organizations` (b2b) or `users` (b2c). It self-installs
// vike-teams (which pulls auth + vike-schema), and contributes a server tier that
// upserts the subscriptions row through universal-orm on its webhook.
export default {
  name: 'vike-stripe-subscription',
  extends: ['import:vike-teams/config:default'],
  meta: {
    segment: { env: { config: true, server: true } },
  },
  segment: 'b2b',
  schemas: 'import:vike-stripe/subscription/schemas:default',
  middleware: 'import:vike-stripe/subscription/middleware:default',
}
