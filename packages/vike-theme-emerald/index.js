// vike-theme-emerald — an example THEME PACKAGE. The composition story of issue
// #24: install the package, and the login page (and every UI authored against the
// theme CSS variables) can switch to it — without the app, vike-auth, or the
// layout knowing the theme exists. The only contract is the token names.
//
// A theme package is just data on top of defineTheme; +config.js registers these
// presets into vike-themes' cumulative `themes` config so the app can select them
// by name. Emerald uses a green brand + rounder corners so the restyle is obvious.
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

export const emerald = { 'emerald-light': emeraldLight, 'emerald-dark': emeraldDark }
export default emerald
