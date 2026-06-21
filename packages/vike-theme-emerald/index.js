// vike-theme-emerald — an example THEME PACKAGE. This is the composition story
// of issue #24: a package ships presets, an app installs it, and every UI
// extension that authors against the theme CSS variables (vike-react-auth's
// login page, the layout shells) restyles — without the theme, the app, or the
// auth extension importing each other. The only contract is the token names.
//
// A theme package is just data on top of vike-themes' defineTheme. Emerald uses
// a green brand + rounder corners so the restyle is unmistakable next to the
// built-in light/dark.
import { defineTheme } from 'vike-themes'

const base = {
  fonts: { sans: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', mono: 'ui-monospace, SFMono-Regular, monospace' },
  radius: '16px', // rounder than the default 10px
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem' },
}

export const emeraldLight = defineTheme({
  name: 'emerald-light',
  ...base,
  colors: {
    bg: '#f7fbf9',
    surface: '#eef6f1',
    text: '#0f1f17',
    muted: '#5b766a',
    border: '#d3e7dc',
    primary: '#059669',
    'primary-text': '#ffffff',
  },
})

export const emeraldDark = defineTheme({
  name: 'emerald-dark',
  ...base,
  colors: {
    bg: '#06110c',
    surface: '#0d1f16',
    text: '#e7f5ee',
    muted: '#84a899',
    border: '#1c3a2b',
    primary: '#10b981',
    'primary-text': '#04150d',
  },
})

// The package's preset set, keyed by name — what an app spreads into its theme map.
export const emerald = { 'emerald-light': emeraldLight, 'emerald-dark': emeraldDark }
export default emerald
