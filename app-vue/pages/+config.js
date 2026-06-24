import vikeVue from 'vike-vue/config'
import authExt from 'vike-auth/vue'
import adminExt from 'vike-admin/vue'
import themesExt from 'vike-themes/vue'
import layoutsExt from 'vike-layouts/vue'
import emeraldExt from 'vike-theme-emerald/config'
import i18nExt from 'vike-i18n/vue'
import toolbarExt from 'vike-toolbar/vue'
import rbacExt from 'vike-rbac/config'
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
  extends: [vikeVue, authExt, adminExt, themesExt, toolbarExt, layoutsExt, emeraldExt, i18nExt, rbacExt],
  title: 'vike-data Vue UI tier',

  appearance: 'system',
  theme: 'acme',
  themes: [acme],

  locales: ['en', 'fr', 'ar'],
  locale: 'en',
  messages: [appMessages],

  defaultRoles: ['member'],

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
