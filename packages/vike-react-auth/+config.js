// vike-react-auth contributes its own translations to the cumulative `messages`
// config (self-installing vike-i18n). Installing this config alongside the
// components means the login UI comes localized — the extension owns its strings.
import { authMessages } from './messages.js'

export default {
  name: 'vike-react-auth',
  extends: ['import:vike-i18n/config:default'],
  messages: [authMessages],
}
