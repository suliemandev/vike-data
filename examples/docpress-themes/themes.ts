export { THEMES, THEME_NAMES, APPEARANCES }
export type { ThemeName, Appearance }

import { defineTheme } from 'vike-themes'
import { emerald } from 'vike-theme-emerald'

// Two brands defined here with vike-themes' core `defineTheme`, plus the shipped
// `emerald` brand imported from its own package — proving a theme package needs
// no DocPress awareness; it is just tokens compiled to CSS variables.

const indigo = defineTheme({
  name: 'indigo',
  radius: '10px',
  light: {
    bg: '#ffffff',
    surface: '#f6f7f9',
    text: '#16181d',
    muted: '#6b7280',
    border: '#e4e7ec',
    primary: '#4f46e5',
    'primary-text': '#ffffff',
  },
  dark: {
    bg: '#0b0c10',
    surface: '#16181f',
    text: '#f2f4f8',
    muted: '#9aa3b2',
    border: '#272b35',
    primary: '#8b7dff',
    'primary-text': '#0b0c10',
  },
})

const sunset = defineTheme({
  name: 'sunset',
  radius: '6px',
  light: {
    bg: '#fffaf5',
    surface: '#fff1e6',
    text: '#2a1c12',
    muted: '#8a6f5c',
    border: '#f0dccb',
    primary: '#e0560d',
    'primary-text': '#ffffff',
  },
  dark: {
    bg: '#160d07',
    surface: '#241710',
    text: '#f6e9dd',
    muted: '#c2a48d',
    border: '#3a2719',
    primary: '#ff7a33',
    'primary-text': '#160d07',
  },
})

const THEMES = { indigo, emerald, sunset } as const
const THEME_NAMES = Object.keys(THEMES) as ThemeName[]
const APPEARANCES = ['system', 'light', 'dark'] as const

type ThemeName = keyof typeof THEMES
type Appearance = (typeof APPEARANCES)[number]
