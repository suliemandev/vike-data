// vike-themes — the framework-agnostic THEME core.
//
// A theme is plain design-token data (colors, fonts, radius, spacing). The
// decoupling substrate is CSS variables: a theme compiles to `--color-primary`,
// `--font-sans`, `--radius`, … at the root, and UI components author against
// those vars without knowing which theme is active. That is what lets a theme
// package restyle every UI extension (e.g. vike-react-auth's login page) without
// either side importing the other — the presentation mirror of how `schemas`
// composes data. Zero framework imports; a React/Vue/Solid wrapper just applies
// the CSS this emits (see vike-react-themes).
//
// Build-time vs runtime split (mirrors schema = config vs data = runtime): the
// theme DEFINITIONS here are static; the ACTIVE selection (dark/light) is runtime
// state layered on top by the framework wrapper.

// token group -> CSS variable prefix. A group whose value is an object expands to
// `--<prefix>-<key>`; a scalar group (e.g. radius: '8px') emits a bare `--<prefix>`.
const VAR_GROUPS = { colors: 'color', fonts: 'font', radius: 'radius', spacing: 'space' }

/**
 * Normalize a design-token object into a theme. Tokens are passed through as-is
 * (plain data); `name` identifies the theme for selection. Compose by spreading
 * a base theme's tokens and overriding what differs (see the presets below).
 */
export function defineTheme(tokens = {}) {
  const { name = 'theme', colors = {}, fonts = {}, radius, spacing = {} } = tokens
  return { name, colors, fonts, radius, spacing }
}

/** Flatten a theme to a { '--var': 'value' } map in declaration order. */
export function themeToVars(theme) {
  const vars = {}
  for (const [group, prefix] of Object.entries(VAR_GROUPS)) {
    const val = theme[group]
    if (val == null) continue
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) vars[`--${prefix}-${k}`] = String(v)
    } else {
      vars[`--${prefix}`] = String(val)
    }
  }
  return vars
}

/**
 * Compile a theme to a CSS rule that sets its variables on `selector`
 * (default `:root`). This string is the entire framework-agnostic contract — any
 * runtime just needs to put it in the document.
 */
export function themeToCss(theme, selector = ':root') {
  const vars = themeToVars(theme)
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}

// --- presets ----------------------------------------------------------------
// light + dark share structure (fonts/radius/spacing) and differ only in colors,
// so dark is light's tokens with the color set swapped. A theme PACKAGE would
// ship presets like these; an app sets/overrides them.
const base = {
  fonts: { sans: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', mono: 'ui-monospace, SFMono-Regular, monospace' },
  radius: '10px',
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem' },
}

export const light = defineTheme({
  name: 'light',
  ...base,
  colors: {
    bg: '#ffffff',
    surface: '#f6f7f9',
    text: '#16181d',
    muted: '#6b7280',
    border: '#e4e7ec',
    primary: '#4f46e5',
    'primary-text': '#ffffff',
  },
})

export const dark = defineTheme({
  name: 'dark',
  ...base,
  colors: {
    bg: '#0b0c10',
    surface: '#16181f',
    text: '#f2f4f8',
    muted: '#9aa3b2',
    border: '#272b35',
    primary: '#8b7dff',
    'primary-text': '#0b0c10',
  },
})

/** The shipped preset set, keyed by name (what a wrapper selects between). */
export const presets = { light, dark }
