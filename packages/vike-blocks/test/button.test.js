// The button block: a leaf catalog element (defineBlock) with variant / size / to refinements.
// The renderer is not node:test-tested (JSX/Vue); this covers the agnostic builder + resolve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { button, definePage, resolvePage, hasBlock } from '../index.js'

test('button is registered', () => {
  assert.ok(hasBlock('button'))
})

test('the builder collapses to a plain descriptor', () => {
  assert.deepEqual(button('Save').build(), { block: 'button', label: 'Save' })
  assert.deepEqual(button('Save').variant('primary').build(), { block: 'button', label: 'Save', variant: 'primary' })
  assert.deepEqual(button('Back').variant('ghost').to('/back').size('sm').build(), {
    block: 'button',
    label: 'Back',
    variant: 'ghost',
    to: '/back',
    size: 'sm',
  })
})

test('resolves as a pass-through section', () => {
  const out = resolvePage(definePage({ sections: [button('Go').variant('secondary')] }))
  assert.equal(out.sections[0].block, 'button')
  assert.deepEqual(out.sections[0].resolved, { label: 'Go', variant: 'secondary' })
})
