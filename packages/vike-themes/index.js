// vike-themes — the framework-agnostic THEME core (the public `.` entry).
//
// This module is the AUTHORING half: `defineTheme` (which derives primary ramps
// via chroma-js) plus the export helpers. It runs at build/config time when a
// theme package or app defines its brand — never in the client bundle. The
// chroma-js import below therefore stays out of the browser: the UI wrappers
// import the chroma-free RUNTIME from `./runtime.js`, and this module re-exports
// it so the package's public surface (`vike-themes`) is unchanged.
//
// See `./runtime.js` for the two-axes model (theme/appearance) and the CSS
// variable contract.
import chroma from 'chroma-js'
import { themeToAppearanceCss } from './runtime.js'

// Re-export the runtime so `import { themeToVars, presets, … } from 'vike-themes'`
// keeps working — the authoring + runtime halves are one public entry.
export * from './runtime.js'

function normalizeColor(value) {
  if (typeof value !== 'string') return null
  const color = value.trim()
  if (!chroma.valid(color)) return null
  return chroma(color).hex().toLowerCase()
}

function createPrimaryRamp(color) {
  const primary = normalizeColor(color)
  if (!primary) return null
  return {
    primary,
    'primary-light': chroma.mix(primary, '#ffffff', 0.22, 'rgb').hex().toLowerCase(),
    'primary-dark': chroma.mix(primary, '#000000', 0.14, 'rgb').hex().toLowerCase(),
  }
}

// Expand a color set: derive `primary-light` / `primary-dark` from a single
// `primary`, normalizing it to hex. Explicit shades always win over the ramp.
function expandColorSet(colors = {}) {
  const ramp = createPrimaryRamp(colors.primary)
  if (!ramp) return { ...colors }
  return {
    ...colors,
    primary: ramp.primary,
    'primary-light': colors['primary-light'] ?? ramp['primary-light'],
    'primary-dark': colors['primary-dark'] ?? ramp['primary-dark'],
  }
}

/**
 * Normalize a brand into a theme: shared structural tokens + a `light` and `dark`
 * color set. Back-compat: a flat `colors` (no light/dark) is used for both modes.
 * A single `primary` per mode expands into the full `primary` / `-light` / `-dark`
 * ramp; explicit shades override the derived ones.
 *
 *   defineTheme({ name, fonts, radius, spacing, light: {…}, dark: {…} })
 */
export function defineTheme(tokens = {}) {
  const { name = 'theme', fonts = {}, radius, spacing = {}, light, dark, colors } = tokens
  return {
    name,
    fonts,
    radius,
    spacing,
    light: expandColorSet(light || colors || {}),
    dark: expandColorSet(dark || colors || light || {}),
  }
}

// --- export (capture the active theme for save / share / SSG) ----------------
// Two small, framework-agnostic helpers that REUSE the runtime compiler as the
// single source of truth (no second compiler): hand back the exact CSS the
// runtime applies for an appearance, or a JSON config that round-trips through
// `defineTheme`. Both normalize first, so a raw token object works too.

/** The CSS a theme emits for an appearance — the canonical `:root { … }` block. */
export function exportThemeCss(theme, appearance = 'system', selector = ':root') {
  return themeToAppearanceCss(defineTheme(theme), appearance, selector)
}

/** A theme as a normalized, pretty-printed JSON config (round-trips via defineTheme). */
export function exportThemeConfig(theme) {
  return JSON.stringify(defineTheme(theme), null, 2)
}
