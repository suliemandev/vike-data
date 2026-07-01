// The card container block: a fluent builder for a bordered surface with an optional header
// (title + description) and footer, wrapping nested blocks resolved recursively. Renderers
// (react/vue) are not node:test-tested (JSX/Vue); this covers the agnostic authoring + resolve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { card, heading, text, button, definePage, resolvePage, hasBlock } from '../index.js'

test('card is registered', () => {
  assert.ok(hasBlock('card'))
})

test('the builder collapses to a descriptor, with nested body/footer builders collapsed too', () => {
  const desc = card([heading('Members').level(3), text('Manage access.')])
    .title('Settings')
    .description('Workspace preferences.')
    .footer([button('Save').variant('primary')])
    .build()

  assert.equal(desc.block, 'card')
  assert.equal(desc.title, 'Settings')
  assert.equal(desc.description, 'Workspace preferences.')
  // nested builders are plain descriptors, not builder objects
  assert.deepEqual(desc.sections, [{ block: 'heading', value: 'Members', level: 3 }, { block: 'text', value: 'Manage access.' }])
  assert.equal(desc.footer.length, 1)
  assert.equal(desc.footer[0].block, 'button')
})

test('.body() sets the body sections too (an alternative to the constructor arg)', () => {
  const desc = card().body([text('via body()')]).build()
  assert.deepEqual(desc.sections, [{ block: 'text', value: 'via body()' }])
})

test('resolve fills body (and footer) recursively; header passes through', () => {
  const page = definePage({
    sections: [card([heading('First').level(2)]).title('Card title').description('A subtitle').footer([text('footer note')])],
  })
  const out = resolvePage(page)
  const c = out.sections[0]
  assert.equal(c.block, 'card')
  assert.equal(c.resolved.title, 'Card title')
  assert.equal(c.resolved.description, 'A subtitle')
  // body sections are resolved view-models the renderer can draw
  assert.equal(c.resolved.sections[0].block, 'heading')
  assert.deepEqual(c.resolved.sections[0].resolved, { value: 'First', level: 2 })
  // footer resolves too
  assert.equal(c.resolved.footer.length, 1)
  assert.deepEqual(c.resolved.footer[0].resolved, { value: 'footer note' })
})

test('a card with no header/footer resolves with nulls (renderer skips those slots)', () => {
  const out = resolvePage(definePage({ sections: [card([text('body only')])] }))
  const c = out.sections[0].resolved
  assert.equal(c.title, null)
  assert.equal(c.description, null)
  assert.equal(c.footer, null)
  assert.equal(c.sections.length, 1)
})

test('a plain descriptor (no builder) resolves too', () => {
  const page = definePage({
    sections: [{ block: 'card', title: 'Raw', sections: [{ block: 'text', value: 'hi' }] }],
  })
  const out = resolvePage(page)
  assert.equal(out.sections[0].resolved.title, 'Raw')
  assert.deepEqual(out.sections[0].resolved.sections[0].resolved, { value: 'hi' })
  assert.equal(out.sections[0].resolved.footer, null)
})

test('cards compose recursively — a card in a card resolves both bodies', () => {
  const out = resolvePage(definePage({ sections: [card([card([text('inner')]).title('Inner')]).title('Outer')] }))
  const outer = out.sections[0].resolved
  assert.equal(outer.title, 'Outer')
  const inner = outer.sections[0]
  assert.equal(inner.block, 'card')
  assert.equal(inner.resolved.title, 'Inner')
  assert.deepEqual(inner.resolved.sections[0].resolved, { value: 'inner' })
})
