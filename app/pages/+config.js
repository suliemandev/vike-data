// The app installs vike-data (the data layer) plus two feature extensions.
// Each extension contributes its schema through vike-data's `schemas` point;
// the app itself defines nothing here. vike-data merges the contributions and
// derives migrations + per-ORM artifacts (see +onRenderHtml.js).
import vikeData from 'vike-data/config'
import authExt from 'example-auth/config'
import billingExt from 'example-billing/config'

export default {
  name: 'example-app',
  extends: [vikeData, authExt, billingExt],
}
