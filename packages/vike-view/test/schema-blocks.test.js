// vike-view's schema-driven blocks: crudBlocks expands a table into list/record/form block
// descriptors, and resolveView derives each from the composed schema through the crud engine.
// The generic composer/registry behavior is tested in vike-elements; this is the schema layer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { defineView, resolveView, crudBlocks, resolveViewTables } from '../index.js'

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

test('crudBlocks expands a table into list/record/form, mixable with single blocks', () => {
  const view = defineView({ route: '/x', sections: [{ block: 'markdown', source: '# Posts' }, crudBlocks({ table: 'posts' })] })
  assert.deepEqual(view.sections.map((s) => s.block), ['markdown', 'list', 'record', 'form'])
})

test('resolveView derives list/record/form blocks from the schema via the crud engine', () => {
  const out = resolveView(defineView({ route: '/posts', sections: crudBlocks({ table: 'posts' }) }), tables())
  assert.equal(out.route, '/posts')
  const [list, record, form] = out.sections
  assert.ok(list.resolved.columns.some((c) => c.name === 'title'))
  assert.equal(record.resolved.fields.find((f) => f.name === 'author_id').fk.table, 'users')
  assert.equal(form.resolved.fields.find((f) => f.name === 'author_id').type, 'select')
})

test('a table block against a missing table is a clear error', () => {
  assert.throws(() => resolveView(defineView({ sections: [{ block: 'list', table: 'ghosts' }] }), tables()), /not in the composed schema/)
})
