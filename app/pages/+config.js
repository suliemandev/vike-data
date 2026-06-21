// The app installs the keystone extensions plus the parameterized billing one.
// Each self-installs its base (the chain ends self-install vike-schema), so the app
// does NOT wire vike-schema in directly. vike-schema merges the contributed schema
// and derives migrations + per-ORM artifacts (see +onRenderHtml.js).
//
// vike-billing's default export bills per-organization (its FK lands in teams'
// `organizations`). Vike's `extends` can't pass options to an extension, so the
// per-USER variant is demonstrated through the codegen driver (pnpm gen with
// BILLING_SUBJECT), not here — see vike-billing/+config.js for that finding.
import authExt from 'vike-auth/config'
import teamsExt from 'vike-teams/config'
import billingExt from 'vike-billing/config'

export default {
  name: 'example-app',
  extends: [authExt, teamsExt, billingExt],
}
