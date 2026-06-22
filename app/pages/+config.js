// The app installs the keystone extensions plus a billing model. Each self-installs
// its base (the chain ends self-install vike-schema), so the app does NOT wire
// vike-schema in directly. vike-schema merges the contributed schema and derives
// migrations + per-ORM artifacts (see +onRenderHtml.js).
//
// Billing is vike-stripe, installed by its model subpath (`subscription`; the subpath
// default export IS the config — no `/config`). It is CONFIGURABLE: `segment` is an
// option it declares ('b2b' | 'b2c' — who you bill); the app sets it here (the
// idiomatic Vike way — a sibling config key, like vike-react's `ssr`). Its schema is
// computed from it. BILLING_SEGMENT picks the value, mirroring how VIKE_DATA_ORM picks
// the ORM.
import authExt from 'vike-auth/config'
import teamsExt from 'vike-teams/config'
import subscriptionExt from 'vike-stripe/subscription'

export default {
  name: 'example-app',
  extends: [authExt, teamsExt, subscriptionExt],
  segment: process.env.BILLING_SEGMENT === 'b2c' ? 'b2c' : 'b2b',
}
