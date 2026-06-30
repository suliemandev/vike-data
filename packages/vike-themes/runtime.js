// vike-themes — the RUNTIME core (chroma-free).
//
// This is the half a UI wrapper touches at run time: a (theme, appearance) pair
// in, CSS variables out. It carries no color math, so nothing here pulls a color
// library into the client bundle. The authoring half (`defineTheme` and its ramp
// derivation, which needs chroma-js) lives in `index.js` and only runs at
// build/config time — see the note there.
//
// Two orthogonal axes (the shadcn/Linear/GitHub model):
//   - THEME (brand)      = structure + palette. A theme carries BOTH modes: shared
//                          tokens (fonts/radius/spacing) + a `light` and a `dark`
//                          color set.
//   - APPEARANCE (mode)  = which color set renders: 'light' | 'dark' | 'system'.
//                          'system' follows the OS and is applied flash-free with
//                          a `@media (prefers-color-scheme)` rule — no JS needed.
//
// The decoupling substrate is CSS variables: a theme compiles to `--color-primary`,
// `--font-sans`, `--radius`, … at the root, and UI components author against those
// vars without knowing which theme/mode is active.

// token group -> CSS variable prefix. An object group expands to `--<prefix>-<key>`;
// a scalar group (e.g. radius: '8px') emits a bare `--<prefix>`.
const VAR_GROUPS = { colors: 'color', fonts: 'font', radius: 'radius', spacing: 'space' }

function flatten(groups) {
  const vars = {}
  for (const [group, prefix] of Object.entries(VAR_GROUPS)) {
    const val = groups[group]
    if (val == null) continue
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) vars[`--${prefix}-${k}`] = String(v)
    } else {
      vars[`--${prefix}`] = String(val)
    }
  }
  return vars
}

/** Flatten a theme's `mode` (light|dark) to a { '--var': value } map. */
export function themeToVars(theme, mode = 'light') {
  const colors = theme[mode] || theme.light || {}
  return flatten({ colors, fonts: theme.fonts, radius: theme.radius, spacing: theme.spacing })
}

/** Compile one mode of a theme to a CSS rule setting its variables on `selector`. */
export function themeToCss(theme, mode = 'light', selector = ':root') {
  const vars = themeToVars(theme, mode)
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}

/**
 * Compile a theme for an APPEARANCE — the whole framework-agnostic contract.
 *   - 'light' | 'dark' : that mode's vars + `color-scheme` (explicit choice).
 *   - 'system'         : light vars by default, dark vars under a
 *                        `@media (prefers-color-scheme: dark)` rule, and
 *                        `color-scheme: light dark`. Follows the OS with no JS and
 *                        no flash (the browser resolves the media query at parse).
 */
export function themeToAppearanceCss(theme, appearance = 'system', selector = ':root') {
  if (appearance === 'light' || appearance === 'dark') {
    return `${themeToCss(theme, appearance, selector)}\n${selector} { color-scheme: ${appearance}; }`
  }
  return [
    themeToCss(theme, 'light', selector),
    `${selector} { color-scheme: light dark; }`,
    `@media (prefers-color-scheme: dark) {\n${themeToCss(theme, 'dark', selector)}\n}`,
  ].join('\n')
}

// --- presets ----------------------------------------------------------------
// One built-in brand, `default`, carrying both modes (the old flat light/dark
// presets collapse into this single theme — appearance picks the mode now).
//
// Authored as a plain literal so the runtime stays chroma-free: the
// `primary-light` / `primary-dark` shades below are the exact ramp `defineTheme`
// derives from each `primary` (a test pins them to the live derivation, so they
// cannot drift). A theme PACKAGE still authors a single `primary` and lets
// `defineTheme` expand it — that runs at build/config time, not here.
const base = {
  fonts: { sans: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', mono: 'ui-monospace, SFMono-Regular, monospace' },
  radius: '10px',
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem' },
}

export const defaultTheme = {
  name: 'default',
  ...base,
  light: {
    bg: '#ffffff',
    surface: '#f6f7f9',
    text: '#16181d',
    muted: '#6b7280',
    border: '#e4e7ec',
    primary: '#4f46e5',
    'primary-light': '#766feb',
    'primary-dark': '#443cc5',
    'primary-text': '#ffffff',
  },
  dark: {
    bg: '#0b0c10',
    surface: '#16181f',
    text: '#f2f4f8',
    muted: '#9aa3b2',
    border: '#272b35',
    primary: '#8b7dff',
    'primary-light': '#a59aff',
    'primary-dark': '#786cdb',
    'primary-text': '#0b0c10',
  },
}

/** The shipped brands, keyed by name (what a wrapper selects between). */
export const presets = { default: defaultTheme }

/** The valid appearance modes. */
export const APPEARANCES = ['system', 'light', 'dark']

// A minimal base/reset, authored against the theme variables. Shipped with the
// theme layer (always installed for any UI) so the page has a sane baseline: no
// browser-default 8px body margin (which leaves an un-themed gutter and overflows
// `min-height: 100vh`), border-box sizing, and a body that picks up the active
// theme's bg/text/font so the background fills edge-to-edge under any shell.
export const baseCss = `*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans, system-ui, sans-serif);
}`
