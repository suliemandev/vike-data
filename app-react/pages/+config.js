// Everything is wired the SAME idiomatic way as the other extensions (auth,
// billing): the app installs each via `extends` and configures it with a sibling
// config key. No ThemeProvider, no shell wiring, no themes.js — those are the
// extensions' job.
//
//   - themes:  install vike-react-themes + the emerald theme PACKAGE; pick the
//              active one with `theme`. The app's OWN brand theme is contributed
//              through the same cumulative `themes` point (customization).
//   - layout:  install vike-react-layouts; pick the shell with `layout`, fill the
//              slots with `logo`/`nav`. Per-page override in pages/login/+config.js.
import vikeReact from 'vike-react/config'
import authExt from 'vike-auth/config'
import themesExt from 'vike-react-themes/config'
import layoutsExt from 'vike-react-layouts/config'
import emeraldExt from 'vike-theme-emerald/config'
import { defineTheme } from 'vike-themes'

// (customization) the app's own brand theme — override only the tokens you want.
// Contributed via the cumulative `themes` config below, exactly like a package.
const acme = defineTheme({
  name: 'acme',
  fonts: { sans: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, monospace' },
  radius: '4px',
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem' },
  colors: {
    bg: '#fffdf7',
    surface: '#faf3e6',
    text: '#2a2016',
    muted: '#8a7a63',
    border: '#ece0cc',
    primary: '#b4530d',
    'primary-text': '#fffaf2',
  },
})

export default {
  extends: [vikeReact, authExt, themesExt, layoutsExt, emeraldExt],
  title: 'vike-data — React UI tier',

  // theme: pick the active theme by name (like billing's `billingSubject`).
  theme: 'light',
  themes: [acme], // the app contributes its own brand theme to the registry

  // layout: pick the app-shell + fill its slots. pages/login overrides to centered.
  layout: 'topbar',
  logo: '◆ Acme',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Login', href: '/login' },
  ],
}
