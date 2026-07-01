// The dialog container block: a fluent builder for a modal that holds nested blocks, with a trigger,
// title/description, an optional footer, and an initial open state. Renderers (react/vue) are not
// node:test-tested (JSX/Vue + portal/DOM); this covers the agnostic authoring + resolve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dialog, text, button, heading, definePage, resolvePage, hasBlock } from '../index.js'

test('dialog is registered', () => {
  assert.ok(hasBlock('dialog'))
})

test('the builder collapses to a descriptor, with nested section builders collapsed too', () => {
  const desc = dialog()
    .title('Delete post')
    .description('This cannot be undone.')
    .trigger('Delete')
    .sections([heading('Confirm').level(3), text('Are you sure?')])
    .footer([button('Cancel').variant('ghost')])
    .build()

  assert.equal(desc.block, 'dialog')
  assert.equal(desc.title, 'Delete post')
  assert.equal(desc.description, 'This cannot be undone.')
  assert.equal(desc.trigger, 'Delete')
  // nested builders are plain descriptors, not builder objects
  assert.deepEqual(desc.sections, [{ block: 'heading', value: 'Confirm', level: 3 }, { block: 'text', value: 'Are you sure?' }])
  assert.deepEqual(desc.footer, [{ block: 'button', label: 'Cancel', variant: 'ghost' }])
  assert.equal(desc.defaultOpen, undefined) // omitted unless set
})

test('resolve fills the body + footer recursively and defaults the chrome', () => {
  const page = definePage({
    sections: [dialog().title('Hi').trigger('Open').sections([text('Body')])],
  })
  const out = resolvePage(page)
  const d = out.sections[0]
  assert.equal(d.block, 'dialog')
  assert.equal(d.resolved.title, 'Hi')
  assert.equal(d.resolved.trigger, 'Open')
  assert.equal(d.resolved.description, null)
  assert.equal(d.resolved.defaultOpen, false)
  assert.deepEqual(d.resolved.footer, [])
  // body sections are resolved view-models the renderer can draw
  assert.equal(d.resolved.sections[0].block, 'text')
  assert.deepEqual(d.resolved.sections[0].resolved, { value: 'Body' })
})

test('defaultOpen is carried through; trigger defaults to "Open"', () => {
  const desc = dialog().title('Auto').sections([text('x')]).defaultOpen().build()
  assert.equal(desc.defaultOpen, true)
  const out = resolvePage(definePage({ sections: [desc] }))
  assert.equal(out.sections[0].resolved.defaultOpen, true)
  assert.equal(out.sections[0].resolved.trigger, 'Open')
})

test('a plain descriptor (no builder) resolves too', () => {
  const page = definePage({
    sections: [{ block: 'dialog', title: 'Raw', trigger: 'Go', sections: [{ block: 'text', value: 'hi' }], footer: [{ block: 'text', value: 'bye' }] }],
  })
  const out = resolvePage(page)
  assert.equal(out.sections[0].resolved.title, 'Raw')
  assert.equal(out.sections[0].resolved.sections[0].resolved.value, 'hi')
  assert.equal(out.sections[0].resolved.footer[0].resolved.value, 'bye')
})
