// The app installs two feature extensions. Each one self-installs vike-data via
// `extends: ['import:vike-data/config:default']`, so the app does NOT wire
// vike-data in directly. vike-data merges the contributed schema and derives
// migrations + per-ORM artifacts (see +onRenderHtml.js).
import authExt from 'example-auth/config'
import billingExt from 'example-billing/config'

export default {
  name: 'example-app',
  extends: [authExt, billingExt],
}
