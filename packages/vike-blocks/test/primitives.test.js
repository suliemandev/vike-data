// The built-in fluent block builders: each builds to a leaf block descriptor and drops
// straight into a page's sections, resolving as a pass-through. Display-only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { text, heading, badge, divider, link, definePage, resolvePage, hasBlock } from '../index.js'

test('block builders collapse to plain block descriptors', () => {
  assert.deepEqual(text('Hello').build(), { block: 'text', value: 'Hello' })
  assert.deepEqual(text('Careful').tone('danger').build(), { block: 'text', value: 'Careful', tone: 'danger' })
  assert.deepEqual(heading('Post').build(), { block: 'heading', value: 'Post', level: 2 })
  assert.deepEqual(heading('Sub').level(3).build(), { block: 'heading', value: 'Sub', level: 3 })
  assert.deepEqual(badge('Draft').tone('warning').build(), { block: 'badge', value: 'Draft', tone: 'warning' })
  assert.deepEqual(divider().build(), { block: 'divider' })
  assert.deepEqual(link('Back').to('/posts').build(), { block: 'link', label: 'Back', to: '/posts' })
})

test('their block types are registered', () => {
  for (const t of ['text', 'heading', 'badge', 'divider', 'link']) assert.ok(hasBlock(t), t)
})

test('blocks compose in a page and resolve as pass-through sections', () => {
  const page = definePage({ route: '/x', sections: [heading('Post').level(1), text('Body'), divider(), link('Back').to('/posts')] })
  const out = resolvePage(page)
  assert.deepEqual(out.sections.map((s) => s.block), ['heading', 'text', 'divider', 'link'])
  assert.deepEqual(out.sections[0].resolved, { value: 'Post', level: 1 })
  assert.deepEqual(out.sections[3].resolved, { label: 'Back', to: '/posts' })
})
