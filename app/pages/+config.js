// The app installs the keystone extensions plus billing. Each self-installs its
// base (the chain ends self-install vike-schema), so the app does NOT wire
// vike-schema in directly. vike-schema merges the contributed schema and derives
// migrations + per-ORM artifacts (see +onRenderHtml.js).
//
// billing is CONFIGURABLE: `billingSubject` is an option billing declares; the app
// sets it here (the idiomatic Vike way — a sibling config key, like vike-react's
// `ssr`). billing's schema is computed from it. BILLING_SUBJECT picks the value,
// mirroring how VIKE_DATA_ORM picks the ORM.
import authExt from 'vike-auth/config'
import teamsExt from 'vike-teams/config'
import billingExt from 'vike-billing/config'

export default {
  name: 'example-app',
  extends: [authExt, teamsExt, billingExt],
  billingSubject: process.env.BILLING_SUBJECT === 'user' ? 'user' : 'organization',
}
