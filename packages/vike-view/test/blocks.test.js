// The block primitive (#383): defineView composes a page from blocks, resolveView turns
// those block descriptors into serializable view-models, and the registry is open. The
// schema-derived blocks (list/record/form) reuse the crud derivation core; bespoke blocks
// (stat/markdown/custom) pass their props through.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import {
  defineView,
  resolveView,
  registerBlock,
  getBlock,
  hasBlock,
  listBlocks,
  crudBlocks,
  resolveViewTables,
} from '../index.js'

const posts = defineSchema('posts', (t) => {
  t.uuid('id').primary()
  t.string('title')
  t.text('body').nullable()
  t.uuid('author_id').references('users.id', { onDelete: 'cascade' })
  t.timestamps()
})
const users = defineSchema('users', (t) => {
  t.uuid('id').primary()
  t.string('email').unique().as('email')
})
const tables = () => resolveViewTables({ schemas: [posts, users] })

// --- defineView normalization -------------------------------------------------

test('defineView requires a sections array and defaults route to null', () => {
  assert.throws(() => defineView(), /expected a definition object/)
  assert.throws(() => defineView({ sections: 'nope' }), /`sections` must be an array/)
  const v = defineView({ sections: [{ block: 'markdown', source: '# hi' }] })
  assert.equal(v.route, null)
  assert.deepEqual(v.sections, [{ block: 'markdown', source: '# hi' }])
})

test('defineView rejects a route that is not a string, and a section without a block type', () => {
  assert.throws(() => defineView({ route: 5, sections: [] }), /`route`.*must be a string/)
  assert.throws(() => defineView({ sections: [{ table: 'posts' }] }), /section 0 must be a block/)
})

test('defineView flattens nested section arrays (so crudBlocks mixes with single blocks)', () => {
  const v = defineView({ route: '/x', sections: [{ block: 'stat', title: 'N' }, crudBlocks({ table: 'posts' })] })
  assert.deepEqual(v.sections.map((s) => s.block), ['stat', 'list', 'record', 'form'])
})

// --- resolveView --------------------------------------------------------------

test('resolveView derives list/record/form blocks from the schema via the crud engine', () => {
  const view = defineView({ route: '/posts', sections: crudBlocks({ table: 'posts' }) })
  const out = resolveView(view, tables())
  assert.equal(out.route, '/posts')
  const [list, record, form] = out.sections
  assert.equal(list.block, 'list')
  assert.ok(list.resolved.columns.some((c) => c.name === 'title'))
  assert.equal(record.resolved.fields.find((f) => f.name === 'author_id').fk.table, 'users')
  assert.equal(form.resolved.fields.find((f) => f.name === 'author_id').type, 'select')
})

test('resolveView passes a bespoke block through as its own props', () => {
  const view = defineView({ sections: [{ block: 'stat', title: 'Revenue', source: 'orders.sum' }] })
  const [stat] = resolveView(view, tables()).sections
  assert.deepEqual(stat.props, { title: 'Revenue', source: 'orders.sum' })
  assert.deepEqual(stat.resolved, { title: 'Revenue', source: 'orders.sum' })
})

test('resolveView throws a clear error on an unknown block type', () => {
  const view = defineView({ sections: [{ block: 'nope' }] })
  assert.throws(() => resolveView(view, tables()), /unknown block "nope"/)
})

test('a table block against a missing table is a clear error', () => {
  const view = defineView({ sections: [{ block: 'list', table: 'ghosts' }] })
  assert.throws(() => resolveView(view, tables()), /not in the composed schema/)
})

// --- the registry is open -----------------------------------------------------

test('built-in block types are registered', () => {
  for (const t of ['list', 'record', 'form', 'stat', 'markdown', 'custom']) assert.ok(hasBlock(t), t)
  assert.ok(listBlocks().length >= 6)
})

test('registerBlock adds a resolvable block type an app can compose', () => {
  registerBlock('gauge', { resolve: ({ props }) => ({ pct: Math.min(100, props.value ?? 0) }) })
  const [g] = resolveView(defineView({ sections: [{ block: 'gauge', value: 150 }] }), tables()).sections
  assert.deepEqual(g.resolved, { pct: 100 })
})

test('registerBlock validates its inputs', () => {
  assert.throws(() => registerBlock(''), /non-empty string type/)
  assert.throws(() => registerBlock('bad', { resolve: 'x' }), /resolve must be a function/)
  assert.equal(getBlock('missing'), null)
})
