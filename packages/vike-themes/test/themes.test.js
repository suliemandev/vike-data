// The theme core is pure data -> CSS. These pin the token->variable contract that
// every UI wrapper and component depends on.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineTheme, themeToVars, themeToCss, presets, light, dark } from '../index.js'

test('defineTheme normalizes a token object and keeps name', () => {
  const t = defineTheme({ name: 'brand', colors: { primary: '#f00' }, radius: '4px' })
  assert.equal(t.name, 'brand')
  assert.deepEqual(t.colors, { primary: '#f00' })
  assert.equal(t.radius, '4px')
})

test('defineTheme applies empty defaults for missing groups', () => {
  const t = defineTheme()
  assert.deepEqual(t, { name: 'theme', colors: {}, fonts: {}, radius: undefined, spacing: {} })
})

test('themeToVars expands object groups to prefixed vars', () => {
  const vars = themeToVars(defineTheme({ colors: { primary: '#abc', 'primary-text': '#fff' }, fonts: { sans: 'X' } }))
  assert.equal(vars['--color-primary'], '#abc')
  assert.equal(vars['--color-primary-text'], '#fff')
  assert.equal(vars['--font-sans'], 'X')
})

test('themeToVars emits a bare var for a scalar group (radius)', () => {
  const vars = themeToVars(defineTheme({ radius: '8px' }))
  assert.equal(vars['--radius'], '8px')
})

test('themeToVars maps spacing to the --space- prefix', () => {
  const vars = themeToVars(defineTheme({ spacing: { md: '1rem' } }))
  assert.equal(vars['--space-md'], '1rem')
})

test('themeToVars skips null/undefined groups', () => {
  const vars = themeToVars({ name: 't', colors: { a: '1' }, fonts: null, radius: undefined, spacing: undefined })
  assert.deepEqual(Object.keys(vars), ['--color-a'])
})

test('themeToCss wraps the vars in the given selector (default :root)', () => {
  const css = themeToCss(defineTheme({ colors: { primary: '#f00' } }))
  assert.match(css, /^:root \{/)
  assert.match(css, /\n {2}--color-primary: #f00;/)
  assert.match(css, /\n\}$/)
})

test('themeToCss honours a custom selector', () => {
  assert.match(themeToCss(defineTheme({ radius: '2px' }), '[data-theme="x"]'), /^\[data-theme="x"\] \{/)
})

test('presets expose light + dark, keyed by name', () => {
  assert.equal(presets.light, light)
  assert.equal(presets.dark, dark)
  assert.equal(light.name, 'light')
  assert.equal(dark.name, 'dark')
})

test('light and dark share structure but differ in colors (composable base)', () => {
  assert.deepEqual(Object.keys(light.colors), Object.keys(dark.colors)) // same token surface
  assert.equal(light.radius, dark.radius) // shared base
  assert.notEqual(light.colors.bg, dark.colors.bg) // different palette
})
