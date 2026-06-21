// The theme core is pure data -> CSS, on two axes: a theme (brand) carries light +
// dark color sets, and an appearance (system/light/dark) selects which renders.
// These pin the token->variable contract every UI wrapper depends on.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineTheme, themeToVars, themeToCss, themeToAppearanceCss, baseCss, presets, defaultTheme, APPEARANCES } from '../index.js'
import config from '../+config.js'

// ----------------------------------------------------------- defineTheme -----

test('defineTheme keeps shared tokens + light/dark color sets', () => {
  const t = defineTheme({ name: 'brand', radius: '4px', light: { primary: '#f00' }, dark: { primary: '#900' } })
  assert.equal(t.name, 'brand')
  assert.equal(t.radius, '4px')
  assert.deepEqual(t.light, { primary: '#f00' })
  assert.deepEqual(t.dark, { primary: '#900' })
})

test('defineTheme back-compat: a flat `colors` fills both modes', () => {
  const t = defineTheme({ name: 'b', colors: { primary: '#abc' } })
  assert.deepEqual(t.light, { primary: '#abc' })
  assert.deepEqual(t.dark, { primary: '#abc' })
})

test('defineTheme applies empty defaults for missing groups', () => {
  const t = defineTheme()
  assert.deepEqual(t, { name: 'theme', fonts: {}, radius: undefined, spacing: {}, light: {}, dark: {} })
})

// ------------------------------------------------------------ themeToVars -----

test('themeToVars uses the requested mode + shared tokens', () => {
  const t = defineTheme({ fonts: { sans: 'X' }, radius: '8px', light: { primary: '#abc' }, dark: { primary: '#123' } })
  assert.equal(themeToVars(t, 'light')['--color-primary'], '#abc')
  assert.equal(themeToVars(t, 'dark')['--color-primary'], '#123')
  assert.equal(themeToVars(t, 'light')['--font-sans'], 'X') // shared across modes
  assert.equal(themeToVars(t, 'light')['--radius'], '8px') // bare var for a scalar group
})

test('themeToVars maps spacing to the --space- prefix and defaults to light', () => {
  const t = defineTheme({ spacing: { md: '1rem' }, light: { a: '1' } })
  assert.equal(themeToVars(t)['--space-md'], '1rem')
  assert.equal(themeToVars(t)['--color-a'], '1') // mode defaults to light
})

// ------------------------------------------------------------- themeToCss -----

test('themeToCss wraps a mode in the selector (default :root)', () => {
  const css = themeToCss(defineTheme({ light: { primary: '#f00' } }), 'light')
  assert.match(css, /^:root \{/)
  assert.match(css, /\n {2}--color-primary: #f00;/)
  assert.match(css, /\n\}$/)
})

test('themeToCss honours a custom selector', () => {
  assert.match(themeToCss(defineTheme({ radius: '2px' }), 'light', '[data-x]'), /^\[data-x\] \{/)
})

// ------------------------------------------------------- themeToAppearanceCss -

const brand = defineTheme({ name: 'b', light: { bg: '#fff' }, dark: { bg: '#000' } })

test('explicit light/dark emits that mode + color-scheme', () => {
  const css = themeToAppearanceCss(brand, 'dark')
  assert.match(css, /--color-bg: #000;/)
  assert.ok(!css.includes('#fff')) // only the dark set
  assert.match(css, /color-scheme: dark;/)
  assert.ok(!css.includes('@media')) // no media query for an explicit choice
})

test('system emits light by default + a prefers-color-scheme dark media rule (flash-free, no JS)', () => {
  const css = themeToAppearanceCss(brand, 'system')
  assert.match(css, /:root \{\n {2}--color-bg: #fff;/) // light at root
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{/)
  assert.match(css, /--color-bg: #000;/) // dark inside the media rule
  assert.match(css, /color-scheme: light dark;/)
})

// ------------------------------------------------------------- presets/api ----

test('presets ship a single `default` brand carrying both modes', () => {
  assert.equal(presets.default, defaultTheme)
  assert.equal(defaultTheme.name, 'default')
  assert.deepEqual(Object.keys(defaultTheme.light), Object.keys(defaultTheme.dark)) // same surface
  assert.notEqual(defaultTheme.light.bg, defaultTheme.dark.bg) // different palette
})

test('APPEARANCES lists the three modes', () => {
  assert.deepEqual(APPEARANCES, ['system', 'light', 'dark'])
})

test('baseCss resets the body margin + box-sizing and themes the body', () => {
  assert.match(baseCss, /html, body \{ margin: 0;/) // no browser-default 8px gutter
  assert.match(baseCss, /box-sizing: border-box/)
  assert.match(baseCss, /background: var\(--color-bg\)/) // body picks up the theme
})

// --------------------------------------------------------------- +config ------

test('+config declares theme + appearance selections and a cumulative themes registry', () => {
  assert.equal(config.meta.theme.cumulative, undefined) // single selection
  assert.equal(config.meta.appearance.cumulative, undefined) // single selection
  assert.equal(config.meta.themes.cumulative, true) // packages register brands
  assert.equal(config.meta.themes.env.client, true) // client-side for the picker
})

test('+config ships the default brand and sensible defaults (system / default)', () => {
  assert.deepEqual(config.themes, [defaultTheme])
  assert.equal(config.theme, 'default')
  assert.equal(config.appearance, 'system')
  assert.ok(config.passToClient.includes('appearanceCookie'))
})
