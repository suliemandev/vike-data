// The Vite plugin factory (plugin.js): its shape and hooks. The codegen behavior it runs is
// covered in generate.test.js (the pure core); here we only assert the plugin wiring, without
// invoking buildStart (which would call Vike's getVikeConfig at build time).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vikeSchema, { vikeSchema as named } from '../plugin.js'

test('default and named exports are the same factory', () => {
  assert.equal(vikeSchema, named)
  assert.equal(typeof vikeSchema, 'function')
})

test('vikeSchema() returns a Vite plugin with the generate hooks', () => {
  const p = vikeSchema()
  assert.equal(p.name, 'vike-schema:generate')
  assert.equal(typeof p.buildStart, 'function')
  assert.equal(typeof p.configResolved, 'function')
})

test('configResolved accepts the resolved Vite config without throwing', () => {
  const p = vikeSchema()
  assert.doesNotThrow(() => p.configResolved({ root: '/tmp/project' }))
})
