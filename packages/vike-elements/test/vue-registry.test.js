// The Vue block-renderer registry (plain JS — the Vue components aren't imported here, matching
// the node:test convention). Verifies the register/get seam and that it delegates to kit's
// shared 'blocks'/'vue' slot, isolated from the react slot.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerElementRenderer, getElementRenderer, elementRendererTokens } from '../vue/registry.js'
import { createComponentRegistry } from '@vike-data/kit'

test('registerElementRenderer / getElementRenderer round-trip (Vue object components)', () => {
  const ListView = { props: ['columns'], setup: () => () => null } // a Vue component object
  assert.equal(getElementRenderer('test-vlist'), undefined)
  assert.equal(registerElementRenderer('test-vlist', ListView), ListView)
  assert.equal(getElementRenderer('test-vlist'), ListView)
  assert.ok(elementRendererTokens().includes('test-vlist'))
})

test('it uses kit’s blocks/vue slot, isolated from blocks/react', () => {
  const V = { setup: () => () => null }
  registerElementRenderer('test-iso', V)
  assert.equal(createComponentRegistry('blocks', 'vue').get('test-iso'), V) // shared vue slot
  assert.equal(createComponentRegistry('blocks', 'react').get('test-iso'), undefined) // not the react slot
})
