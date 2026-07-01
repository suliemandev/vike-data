// The generic substrate: definePage composes a page from blocks, resolvePage turns block
// descriptors into serializable view-models, the registry is open, and defineBlock gives
// a leaf block a fluent builder. No schema here — the schema-derived blocks live in vike-view.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  definePage,
  resolvePage,
  registerBlock,
  getBlock,
  hasBlock,
  listBlocks,
  defineBlock,
} from '../index.js'

// --- definePage normalization -------------------------------------------------

test('definePage requires a sections array and defaults route to null', () => {
  assert.throws(() => definePage(), /expected a definition object/)
  assert.throws(() => definePage({ sections: 'nope' }), /`sections` must be an array/)
  const p = definePage({ sections: [{ block: 'markdown', source: '# hi' }] })
  assert.equal(p.route, null)
  assert.deepEqual(p.sections, [{ block: 'markdown', source: '# hi' }])
})

test('definePage rejects a non-string route and a section without a block type', () => {
  assert.throws(() => definePage({ route: 5, sections: [] }), /`route`.*must be a string/)
  assert.throws(() => definePage({ sections: [{ table: 'posts' }] }), /section 0 must be a block/)
})

test('definePage flattens nested section arrays and collapses block builders', () => {
  const p = definePage({ sections: [{ block: 'stat', title: 'N' }, [{ block: 'markdown', source: 'x' }, { block: 'custom', component: 'C' }]] })
  assert.deepEqual(p.sections.map((s) => s.block), ['stat', 'markdown', 'custom'])
})

// --- resolvePage --------------------------------------------------------------

test('resolvePage passes a bespoke block through as its own props', () => {
  const [stat] = resolvePage(definePage({ sections: [{ block: 'stat', title: 'Revenue', source: 'x' }] })).sections
  assert.deepEqual(stat.props, { title: 'Revenue', source: 'x' })
  assert.deepEqual(stat.resolved, { title: 'Revenue', source: 'x' })
})

test('resolvePage throws a clear error on an unknown block type', () => {
  assert.throws(() => resolvePage(definePage({ sections: [{ block: 'nope' }] })), /unknown block "nope"/)
})

// --- registry + defineBlock -------------------------------------------------

test('built-in blocks are registered', () => {
  for (const t of ['stat', 'markdown', 'custom', 'text', 'heading', 'badge', 'divider', 'link']) assert.ok(hasBlock(t), t)
  assert.ok(listBlocks().length >= 8)
})

test('registerBlock adds a resolvable block an app can compose', () => {
  registerBlock('gauge', { resolve: ({ props }) => ({ pct: Math.min(100, props.value ?? 0) }) })
  const [g] = resolvePage(definePage({ sections: [{ block: 'gauge', value: 150 }] })).sections
  assert.deepEqual(g.resolved, { pct: 100 })
})

test('registerBlock validates its inputs', () => {
  assert.throws(() => registerBlock(''), /non-empty string type/)
  assert.throws(() => registerBlock('bad', { resolve: 'x' }), /resolve must be a function/)
  assert.equal(getBlock('missing'), null)
})

test('defineBlock registers a block and returns a fluent builder factory', () => {
  const rating = defineBlock('rating', {
    build: (value) => ({ value }),
    refine: { max: (n) => ({ max: n }), readonly: () => ({ readonly: true }) },
  })
  assert.ok(hasBlock('rating'))
  assert.deepEqual(rating(3).max(5).readonly().build(), { block: 'rating', value: 3, max: 5, readonly: true })
  // and it composes + resolves as a pass-through
  const [r] = resolvePage(definePage({ sections: [rating(4)] })).sections
  assert.deepEqual(r.resolved, { value: 4 })
})

test('defineBlock validates build/refine at define time', () => {
  assert.throws(() => defineBlock('x', { build: 'no' }), /build must be a function/)
  assert.throws(() => defineBlock('x', { refine: 5 }), /refine must be an object/)
  // a non-function refinement is caught HERE, not later in app code
  assert.throws(() => defineBlock('x', { refine: { max: 5 } }), /refine\.max must be a function/)
})

// --- robustness fixes ---------------------------------------------------------

test('a bespoke block may carry a prop named "build" (duck-type is callable, not truthy)', () => {
  const p = definePage({ sections: [{ block: 'deploy', build: 'ci-123' }] })
  assert.deepEqual(p.sections, [{ block: 'deploy', build: 'ci-123' }])
})

test('definePage flattens deeply, so a preset of presets still composes', () => {
  const p = definePage({ sections: [[[{ block: 'stat', title: 'A' }]], { block: 'markdown', source: 'x' }] })
  assert.deepEqual(p.sections.map((s) => s.block), ['stat', 'markdown'])
})

test('dropping a crud() config into sections points to crudBlocks', () => {
  assert.throws(
    () => definePage({ sections: [{ table: 'posts', icon: null }] }),
    /did you mean \.\.\.crudBlocks\(\{ table: "posts" \}\)/,
  )
})

test('resolvePage names the failing section when a block resolve throws', () => {
  registerBlock('boom', { resolve: () => { throw new Error('kaboom') } })
  assert.throws(
    () => resolvePage(definePage({ sections: [{ block: 'stat' }, { block: 'boom' }] })),
    /block "boom" \(section 1\) failed to resolve: kaboom/,
  )
})
