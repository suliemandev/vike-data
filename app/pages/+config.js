// The app installs the keystone extensions. vike-teams self-installs vike-auth,
// which self-installs vike-schema, so the whole chain composes from these installs
// (vike-auth is listed explicitly for clarity; teams would pull it in regardless).
// The app does NOT wire vike-schema in directly. vike-schema merges the contributed
// schema and derives migrations + per-ORM artifacts (see +onRenderHtml.js).
import authExt from 'vike-auth/config'
import teamsExt from 'vike-teams/config'

export default {
  name: 'example-app',
  extends: [authExt, teamsExt],
}
