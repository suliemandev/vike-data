// vike-auth/ar — the ARABIC language subpath of vike-auth (see vike-auth/fr for the
// model). Contributes the Arabic catalog to the cumulative `messages`:
//
//   import authReact from 'vike-auth/react'
//   import authAr from 'vike-auth/ar'
//   extends: [authReact, authAr]
//
// RTL note: this ships the strings; mapping the active locale to a layout direction
// (dir="rtl") is the layout tier's job and tracked as a follow-up (#54).
import { authMessagesAr } from './messages.js'

export default {
  name: 'vike-auth-ar',
  extends: ['import:vike-i18n/config:default'],
  messages: [authMessagesAr],
}
