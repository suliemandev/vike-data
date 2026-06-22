// Register the French auth strings into the cumulative `messages` config. The app
// installs this like any extension (`extends: [authFrExt]`); French then appears
// in the locale picker and the auth UI follows it. Plain serializable data, inline.
import { authMessagesFr } from './index.js'

export default {
  name: 'vike-auth-fr',
  extends: ['import:vike-i18n/config:default'],
  messages: [authMessagesFr],
}
