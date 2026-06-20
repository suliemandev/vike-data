// The app. It installs vike-data (the data layer) plus two independent feature
// extensions, and adds one app-level migration of its own.
//
// The whole question spike 1 answers: does vike-data's cumulative `migrations`
// config end up holding the contributions from vike-data + BOTH extensions + the
// app, merged by Vike with no side-channel global?
import vikeData from 'vike-data/config'
import authExt from 'example-auth/config'
import billingExt from 'example-billing/config'

export default {
  name: 'example-app',
  extends: [vikeData, authExt, billingExt],
  migrations: ['100_create_app_posts_table'],
}
