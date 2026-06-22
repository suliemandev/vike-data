// vike-stripe/b2b-payment — the one-time-charge billing model. Installed exactly like
// b2c-subscription (the subpath default export IS the config; no `/config`):
//
//   import payments from 'vike-stripe/b2b-payment'
//   export default { extends: [payments], billingSubject: 'organization' }
//
// Same parameterization (`billingSubject` re-points the subject FK) and the same
// composition (self-installs vike-teams); its server tier INSERTs a payments row
// through universal-orm on its webhook. Install it alongside b2c-subscription, or on
// its own — they are independent Lego pieces.
export default {
  name: 'vike-stripe-b2b-payment',
  extends: ['import:vike-teams/config:default'],
  meta: {
    billingSubject: { env: { config: true, server: true } },
  },
  billingSubject: 'organization',
  schemas: 'import:vike-stripe/b2b-payment/schemas:default',
  middleware: 'import:vike-stripe/b2b-payment/middleware:default',
}
