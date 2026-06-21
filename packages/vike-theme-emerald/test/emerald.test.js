// A theme package is data; this pins that it ships valid, distinct presets so a
// consumer can rely on the token surface.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themeToVars } from 'vike-themes'
import emerald, { emeraldLight, emeraldDark } from '../index.js'

test('exports a light + dark preset pair keyed by name', () => {
  assert.equal(emerald['emerald-light'], emeraldLight)
  assert.equal(emerald['emerald-dark'], emeraldDark)
})

test('presets share the token surface so a theme swap is total', () => {
  assert.deepEqual(Object.keys(emeraldLight.colors), Object.keys(emeraldDark.colors))
})

test('emits the same CSS-variable names as any theme (composition contract)', () => {
  const vars = themeToVars(emeraldLight)
  // the contract UI authors against: --color-primary etc. must be present
  assert.ok('--color-primary' in vars)
  assert.ok('--color-bg' in vars)
  assert.ok('--radius' in vars)
  assert.equal(vars['--color-primary'], '#059669')
})

test('is visibly distinct from a plain palette (different primary + radius)', () => {
  assert.equal(themeToVars(emeraldLight)['--radius'], '16px') // rounder than default 10px
  assert.notEqual(themeToVars(emeraldLight)['--color-primary'], '#4f46e5') // not the default indigo
})
