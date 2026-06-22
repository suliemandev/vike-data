// vike-auth/fr — the FRENCH language subpath of vike-auth. A language is a variant
// axis just like the framework (vike-auth/react), so it lives as a SUBPATH of the
// one package, not a separate vike-auth-fr package. The default export is a Vike
// config the app extends alongside the framework subpath:
//
//   import authReact from 'vike-auth/react'
//   import authFr from 'vike-auth/fr'
//   extends: [authReact, authFr]
//
// It contributes the French catalog to the cumulative `messages` and extends the
// headless vike-i18n core (for the `messages` key). English is NOT here — it ships
// inline with the components and is the universal fallback. Install only the
// languages you use; they tree-shake.
import { authMessagesFr } from './messages.js'

export default {
  name: 'vike-auth-fr',
  extends: ['import:vike-i18n/config:default'],
  messages: [authMessagesFr],
}
