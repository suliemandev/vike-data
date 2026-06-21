// A theme package is data; pin that it ships valid, distinct presets and that its
// +config registers them into the cumulative `themes` point for composition.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themeToVars } from 'vike-themes'
import emerald, { emeraldLight, emeraldDark } from '../index.js'
import config from '../+config.js'

test('exports a light + dark preset pair keyed by name', () => {
  assert.equal(emerald['emerald-light'], emeraldLight)
  assert.equal(emerald['emerald-dark'], emeraldDark)
})

test('presets share the token surface so a theme swap is total', () => {
  assert.deepEqual(Object.keys(emeraldLight.colors), Object.keys(emeraldDark.colors))
})

test('emits the standard CSS-variable names (composition contract)', () => {
  const vars = themeToVars(emeraldLight)
  assert.ok('--color-primary' in vars)
  assert.ok('--radius' in vars)
  assert.equal(vars['--color-primary'], '#059669')
})

test('is visibly distinct from a plain palette (primary + radius)', () => {
  assert.equal(themeToVars(emeraldLight)['--radius'], '16px')
  assert.notEqual(themeToVars(emeraldLight)['--color-primary'], '#4f46e5')
})

test('+config registers both presets into the cumulative themes point and self-installs vike-themes', () => {
  assert.deepEqual(config.themes, [emeraldLight, emeraldDark])
  assert.ok(config.extends.includes('import:vike-themes/config:default'))
})
