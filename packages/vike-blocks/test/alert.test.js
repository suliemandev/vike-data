// The alert leaf block: a fluent builder for a tone-styled notice. A pass-through block (its resolved
// model is its props). Renderers (react/vue) are not node:test-tested (JSX/Vue); this covers the
// agnostic authoring + resolve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alert, definePage, resolvePage, hasBlock } from '../index.js'

test('alert is registered', () => {
  assert.ok(hasBlock('alert'))
})

test('the builder collapses to a descriptor', () => {
  assert.deepEqual(alert('Heads up').intent('warning').body('Trial ends soon.').build(), {
    block: 'alert',
    title: 'Heads up',
    intent: 'warning',
    body: 'Trial ends soon.',
  })
})

test('title-only and intent-only forms build', () => {
  assert.deepEqual(alert('Saved').intent('success').build(), { block: 'alert', title: 'Saved', intent: 'success' })
  assert.deepEqual(alert('Note').build(), { block: 'alert', title: 'Note' })
})

test('resolve is a pass-through (model = props minus block type)', () => {
  const out = resolvePage(definePage({ sections: [alert('Hi').intent('info').body('there')] }))
  const a = out.sections[0]
  assert.equal(a.block, 'alert')
  assert.deepEqual(a.resolved, { title: 'Hi', intent: 'info', body: 'there' })
})

test('a plain descriptor (no builder) resolves too', () => {
  const out = resolvePage(definePage({ sections: [{ block: 'alert', title: 'Raw', intent: 'danger' }] }))
  assert.deepEqual(out.sections[0].resolved, { title: 'Raw', intent: 'danger' })
})
