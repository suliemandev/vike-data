// The accordion container block: a fluent builder for expand/collapse items of nested blocks,
// resolved recursively, with single/multi-open mode and an initial open set. Renderers (react/vue)
// are not node:test-tested (JSX/Vue); this covers the agnostic authoring + resolve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accordion, heading, text, definePage, resolvePage, hasBlock } from '../index.js'

test('accordion is registered', () => {
  assert.ok(hasBlock('accordion'))
})

test('the builder collapses to a descriptor, with nested section builders collapsed too', () => {
  const desc = accordion()
    .item('shipping', 'Shipping', [heading('Shipping').level(3), text('Ships in 2-3 days.')])
    .item('returns', 'Returns', [text('30-day returns.')])
    .defaultValue('shipping')
    .build()

  assert.equal(desc.block, 'accordion')
  assert.equal(desc.mode, 'single')
  assert.equal(desc.defaultValue, 'shipping')
  assert.equal(desc.items.length, 2)
  assert.deepEqual(desc.items[0], {
    value: 'shipping',
    label: 'Shipping',
    // nested builders are plain descriptors, not builder objects
    sections: [{ block: 'heading', value: 'Shipping', level: 3 }, { block: 'text', value: 'Ships in 2-3 days.' }],
  })
})

test('resolve fills each item recursively; single-open defaults to nothing open', () => {
  const page = definePage({
    sections: [accordion().item('a', 'A', [heading('First').level(2)]).item('b', 'B', [text('Second')])],
  })
  const out = resolvePage(page)
  const acc = out.sections[0]
  assert.equal(acc.block, 'accordion')
  assert.equal(acc.resolved.multiple, false)
  assert.deepEqual(acc.resolved.openValues, []) // no defaultValue -> all collapsed
  assert.equal(acc.resolved.items.length, 2)
  // item sections are resolved view-models the renderer can draw
  assert.equal(acc.resolved.items[0].sections[0].block, 'heading')
  assert.deepEqual(acc.resolved.items[0].sections[0].resolved, { value: 'First', level: 2 })
  assert.deepEqual(acc.resolved.items[1].sections[0].resolved, { value: 'Second' })
})

test('single-open keeps only the first declared default even if several are given', () => {
  const page = definePage({
    sections: [accordion().item('a', 'A', []).item('b', 'B', []).defaultValue(['b', 'a'])],
  })
  const out = resolvePage(page)
  assert.equal(out.sections[0].resolved.multiple, false)
  assert.deepEqual(out.sections[0].resolved.openValues, ['b'])
})

test('multi-open mode keeps every declared default open', () => {
  const desc = accordion().multiple().item('a', 'A', []).item('b', 'B', []).defaultValue(['a', 'b']).build()
  assert.equal(desc.mode, 'multiple')
  const out = resolvePage(definePage({ sections: [desc] }))
  assert.equal(out.sections[0].resolved.multiple, true)
  assert.deepEqual(out.sections[0].resolved.openValues, ['a', 'b'])
})

test('a plain descriptor (no builder) resolves too; a label defaults to the value', () => {
  const page = definePage({
    sections: [{ block: 'accordion', mode: 'multiple', defaultValue: 'one', items: [{ value: 'one', sections: [{ block: 'text', value: '1' }] }] }],
  })
  const out = resolvePage(page)
  assert.equal(out.sections[0].resolved.items[0].label, 'one') // label defaults to value
  assert.deepEqual(out.sections[0].resolved.openValues, ['one']) // multi-open normalizes a string default
})
