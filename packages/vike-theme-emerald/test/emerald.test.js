// A theme package is data; pin that it ships one valid brand carrying both modes
// and that its +config registers it into the cumulative `themes` point.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themeToVars } from 'vike-themes'
import emerald from '../index.js'
import config from '../+config.js'

test('exports one Emerald brand with light + dark color sets', () => {
  assert.equal(emerald.name, 'emerald')
  assert.deepEqual(Object.keys(emerald.light), Object.keys(emerald.dark)) // same surface
  assert.notEqual(emerald.light.bg, emerald.dark.bg) // different palette per mode
})

test('emits the standard CSS-variable names per mode (composition contract)', () => {
  assert.equal(themeToVars(emerald, 'light')['--color-primary'], '#059669')
  assert.equal(themeToVars(emerald, 'dark')['--color-primary'], '#10b981')
  assert.equal(themeToVars(emerald, 'light')['--radius'], '16px')
})

test('is visibly distinct from the default brand (primary + radius)', () => {
  assert.equal(themeToVars(emerald, 'light')['--radius'], '16px') // rounder than default 10px
  assert.notEqual(themeToVars(emerald, 'light')['--color-primary'], '#4f46e5') // not default indigo
})

test('+config registers the brand into the cumulative themes point and self-installs vike-themes', () => {
  assert.deepEqual(config.themes, [emerald])
  assert.ok(config.extends.includes('import:vike-themes/config:default'))
})
