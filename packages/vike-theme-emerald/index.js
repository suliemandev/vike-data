// vike-theme-emerald — an example THEME PACKAGE: one Emerald brand carrying both
// modes. The composition story of issue #24 — install the package and Emerald
// becomes a selectable theme, without the app, vike-auth, or the layout knowing
// it exists. A theme package is just data on top of defineTheme; +config.js
// registers it into vike-themes' cumulative `themes` config. Green brand + rounder
// corners so the restyle is obvious next to the default.
import { defineTheme } from 'vike-themes'

export const emerald = defineTheme({
  name: 'emerald',
  fonts: { sans: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', mono: 'ui-monospace, SFMono-Regular, monospace' },
  radius: '16px', // rounder than the default 10px
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem' },
  light: {
    bg: '#f7fbf9',
    surface: '#eef6f1',
    text: '#0f1f17',
    muted: '#5b766a',
    border: '#d3e7dc',
    primary: '#059669',
    'primary-text': '#ffffff',
  },
  dark: {
    bg: '#06110c',
    surface: '#0d1f16',
    text: '#e7f5ee',
    muted: '#84a899',
    border: '#1c3a2b',
    primary: '#10b981',
    'primary-text': '#04150d',
  },
})

export default emerald
