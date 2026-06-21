// ─────────────────────────────────────────────────────────────────────────────
// How app-react gets its themes. A theme is just design-token data compiled to
// CSS variables (vike-themes); the <ThemeProvider> in pages/+Layout.jsx is handed
// the map below and applies whichever one is active. There are THREE sources, and
// they all just merge into one plain object — that is the whole composition story:
//
//   1. BUILT-IN presets        — light / dark, shipped by vike-themes
//   2. AN INSTALLED PACKAGE     — vike-theme-emerald (composition: nothing in the
//                                 app or in vike-auth knows it exists; it restyles
//                                 the login page purely through the shared CSS vars)
//   3. YOUR OWN BRAND theme     — defined right here with defineTheme (customization)
//
// To add a theme: install a theme package and spread it in, or call defineTheme
// and add it. To customize the look, edit the tokens in `acme` below and watch
// every screen (login card, shells, buttons) follow.
// ─────────────────────────────────────────────────────────────────────────────
import { presets, defineTheme } from 'vike-themes'
import emerald from 'vike-theme-emerald'

// (3) CUSTOMIZE: an app-defined brand theme. Override only the tokens you care
// about — here a warm, serif, sharp-cornered "Acme" look that is obviously not the
// default. Components never change; only these values do.
export const acme = defineTheme({
  name: 'acme',
  fonts: { sans: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, monospace' },
  radius: '4px', // sharp corners
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem' },
  colors: {
    bg: '#fffdf7',
    surface: '#faf3e6',
    text: '#2a2016',
    muted: '#8a7a63',
    border: '#ece0cc',
    primary: '#b4530d', // burnt orange
    'primary-text': '#fffaf2',
  },
})

// The full set the app offers — built-ins + the installed package + the brand
// theme, all in one flat name→theme map the ThemeProvider selects between.
export const themes = {
  ...presets, // light, dark
  ...emerald, // emerald-light, emerald-dark
  acme,
}

// Friendly labels for the picker UI (falls back to the key when absent).
export const themeLabels = {
  light: 'Default · Light',
  dark: 'Default · Dark',
  'emerald-light': 'Emerald · Light',
  'emerald-dark': 'Emerald · Dark',
  acme: 'Acme Brand',
}

export const defaultTheme = 'light'
