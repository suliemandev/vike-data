// The tabs container block: a fluent builder for panels of nested blocks, resolved recursively,
// with an initial active tab. Renderers (react/vue) are not node:test-tested (JSX/Vue); this covers
// the agnostic authoring + resolve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tabs, heading, text, definePage, resolvePage, hasBlock } from '../index.js'

test('tabs is registered', () => {
  assert.ok(hasBlock('tabs'))
})

test('the builder collapses to a descriptor, with nested section builders collapsed too', () => {
  const desc = tabs()
    .tab('account', 'Account', [heading('Account').level(3), text('Your profile.')])
    .tab('password', 'Password', [text('Change your password.')])
    .defaultValue('password')
    .build()

  assert.equal(desc.block, 'tabs')
  assert.equal(desc.defaultValue, 'password')
  assert.equal(desc.tabs.length, 2)
  assert.deepEqual(desc.tabs[0], {
    value: 'account',
    label: 'Account',
    // nested builders are plain descriptors, not builder objects
    sections: [{ block: 'heading', value: 'Account', level: 3 }, { block: 'text', value: 'Your profile.' }],
  })
})

test('resolve fills each panel recursively and defaults the active tab to the first', () => {
  const page = definePage({
    sections: [tabs().tab('a', 'A', [heading('First').level(2)]).tab('b', 'B', [text('Second')])],
  })
  const out = resolvePage(page)
  const t = out.sections[0]
  assert.equal(t.block, 'tabs')
  assert.equal(t.resolved.activeValue, 'a') // first panel, no defaultValue
  assert.equal(t.resolved.tabs.length, 2)
  // panel sections are resolved view-models the renderer can draw
  assert.equal(t.resolved.tabs[0].sections[0].block, 'heading')
  assert.deepEqual(t.resolved.tabs[0].sections[0].resolved, { value: 'First', level: 2 })
  assert.deepEqual(t.resolved.tabs[1].sections[0].resolved, { value: 'Second' })
})

test('declared defaultValue wins; a plain descriptor (no builder) resolves too', () => {
  const page = definePage({
    sections: [{ block: 'tabs', defaultValue: 'two', tabs: [{ value: 'one', label: 'One', sections: [{ block: 'text', value: '1' }] }, { value: 'two', label: 'Two', sections: [{ block: 'text', value: '2' }] }] }],
  })
  const out = resolvePage(page)
  assert.equal(out.sections[0].resolved.activeValue, 'two')
  assert.equal(out.sections[0].resolved.tabs[1].label, 'Two')
})

test('a label defaults to the value when omitted', () => {
  const out = resolvePage(definePage({ sections: [{ block: 'tabs', tabs: [{ value: 'solo', sections: [] }] }] }))
  assert.equal(out.sections[0].resolved.tabs[0].label, 'solo')
})
