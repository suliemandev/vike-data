// The React block-renderer registry (plain JS — the JSX components aren't imported here, matching
// the family's node:test convention). Verifies the register/get seam and that it delegates to
// kit's shared 'blocks'/'react' component registry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerBlockRenderer, getBlockRenderer, blockRendererTokens } from '../react/registry.js'
import { createComponentRegistry } from '@vike-data/kit'

test('registerBlockRenderer / getBlockRenderer round-trip', () => {
  const Gauge = () => null
  assert.equal(getBlockRenderer('test-gauge'), undefined) // unregistered -> fall back
  assert.equal(registerBlockRenderer('test-gauge', Gauge), Gauge)
  assert.equal(getBlockRenderer('test-gauge'), Gauge)
  assert.ok(blockRendererTokens().includes('test-gauge'))
})

test('it registers into kit’s shared blocks/react slot (so vike-view + third parties compose)', () => {
  const Rating = () => null
  registerBlockRenderer('test-rating', Rating)
  // a fresh handle to the same (namespace, name) sees it — the cross-package guarantee
  assert.equal(createComponentRegistry('blocks', 'react').get('test-rating'), Rating)
})

test('registration is validated (delegates to kit)', () => {
  assert.throws(() => registerBlockRenderer('', () => null), /non-empty string/)
  assert.throws(() => registerBlockRenderer('x', 'not-a-component'), /must be a function/)
})
