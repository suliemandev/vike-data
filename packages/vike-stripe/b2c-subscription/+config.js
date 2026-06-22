// vike-stripe/b2c-subscription — the recurring-subscription billing model, installed
// the idiomatic Vike way (the subpath default export IS the config; no `/config`):
//
//   import subscriptions from 'vike-stripe/b2c-subscription'
//   export default { extends: [subscriptions], billingSubject: 'organization' }
//
// It declares `billingSubject` and computes its schema from it (a function wired as a
// pointer-import, since a runtime config value can't be an inline function), so the
// subject FK lands in `organizations` (default) or `users`. It self-installs
// vike-teams (which pulls auth + vike-schema), and contributes a server tier that
// upserts the subscriptions row through universal-orm on its webhook.
export default {
  name: 'vike-stripe-b2c-subscription',
  extends: ['import:vike-teams/config:default'],
  meta: {
    billingSubject: { env: { config: true, server: true } },
  },
  billingSubject: 'organization',
  schemas: 'import:vike-stripe/b2c-subscription/schemas:default',
  middleware: 'import:vike-stripe/b2c-subscription/middleware:default',
}
