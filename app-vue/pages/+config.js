import vikeVue from 'vike-vue/config'
import authExt from 'vike-auth/vue'
import adminExt from 'vike-admin/vue'
import themesExt from 'vike-themes/vue'
import layoutsExt from 'vike-layouts/vue'
import emeraldExt from 'vike-theme-emerald/config'
import i18nExt from 'vike-i18n/vue'
import toolbarExt from 'vike-toolbar/vue'
import rbacExt from 'vike-rbac/config'
import pushExt from 'vike-push/config'
import { defineTheme } from 'vike-themes'
import { appMessages } from '../messages.js'

const acme = defineTheme({
  name: 'acme',
  fonts: { sans: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, monospace' },
  radius: '4px',
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem' },
  light: {
    bg: '#fffdf7',
    surface: '#faf3e6',
    text: '#2a2016',
    muted: '#8a7a63',
    border: '#ece0cc',
    primary: '#b4530d',
    'primary-text': '#fffaf2',
  },
  dark: {
    bg: '#1a140d',
    surface: '#241c12',
    text: '#f3ead9',
    muted: '#b39e80',
    border: '#3a2e1d',
    primary: '#e0772a',
    'primary-text': '#1a140d',
  },
})

export default {
  extends: [vikeVue, authExt, adminExt, themesExt, toolbarExt, layoutsExt, emeraldExt, i18nExt, rbacExt, pushExt],

  // push: install vike-push (adds the push_subscriptions table + the /push/subscribe
  // endpoint). The VAPID public key the subscribe control hands to PushManager; the matching
  // private key lives server-side in the app's push transport (+onCreateGlobalContext.js
  // registers the real Web Push transport when VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY are set,
  // otherwise the dev console/outbox transport, which needs no private key). Set
  // VAPID_PUBLIC_KEY to use your own keypair (it must match the private key); the fallback is
  // a demo public key, so subscribing works out of the box but real delivery does not.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || 'BDNJY5tBAEFdFWQFeZjDA0JoEm0MscKeDo5JpxJ1QCm2hv56lroZiHk0a3NEvq6sPJsIBGXOIsyKaf4BRP4aEG4',
  title: 'vike-data Vue UI tier',

  appearance: 'system',
  theme: 'acme',
  themes: [acme],

  locales: ['en', 'fr', 'ar'],
  locale: 'en',
  messages: [appMessages],

  defaultRoles: ['member'],

  // rbac + Telefunc seam (#110/#128): one universal middleware serves guarded RPCs in dev
  // AND prod. The seam relocates telefunc's endpoint off `/_telefunc` so telefunc's own
  // context-less dev middleware never intercepts it; pages/+client.js points the browser
  // telefunc client at the relocated endpoint, `middleware` owns it server-side. See
  // pages/rpc-demo.
  middleware: ['import:vike-rbac/telefunc-middleware:default'],

  layout: 'topbar',
  logo: '◆ Acme',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Admin', href: '/admin' },
    { label: 'RPC', href: '/rpc-demo' },
    { label: 'Account', href: '/account' },
    { label: 'Login', href: '/login' },
  ],
}
