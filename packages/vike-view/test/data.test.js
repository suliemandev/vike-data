// The server-side data layer, exercised on the memory adapter (the same adapter the demo and
// every other extension test run on): hydrateView fills a list block's paged rows + FK labels
// and a record block's row; the write path (create/update/delete) round-trips; and row scoping
// bounds both reads and writes.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineView, crudBlocks, resolveViewTables, buildDb, hydrateView, createRow, updateRow, deleteRow } from '../index.js'

const users = defineSchema('users', (t) => {
  t.uuid('id').primary()
  t.string('email').as('email')
})
const posts = defineSchema('posts', (t) => {
  t.uuid('id').primary()
  t.string('title')
  t.uuid('author_id').references('users.id')
  t.uuid('user_id') // owner
  t.timestamps()
})

const config = { schemas: [users, posts] }
const tables = () => resolveViewTables(config)

// A tiny FormData-shaped stand-in (get/has), what the write path reads.
const form = (obj) => ({ get: (k) => (k in obj ? obj[k] : null), has: (k) => k in obj })

let db
beforeEach(async () => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
  db = buildDb(tables())
  await db.users.insert({ id: 'u1', email: 'alice@x.com' })
  await db.users.insert({ id: 'u2', email: 'bob@x.com' })
  await db.posts.insert({ id: 'p1', title: 'Alice One', author_id: 'u1', user_id: 'u1' })
  await db.posts.insert({ id: 'p2', title: 'Bob One', author_id: 'u2', user_id: 'u2' })
})

test('hydrateView fills a list block with rows + FK labels', async () => {
  const view = defineView({ sections: crudBlocks({ table: 'posts' }) })
  const out = await hydrateView(view, { tables: tables(), db })
  const list = out.sections.find((s) => s.block === 'list')
  assert.equal(list.resolved.total, 2)
  assert.deepEqual(list.resolved.rows.map((r) => r.title).sort(), ['Alice One', 'Bob One'])
  // the author_id FK cell resolves to the referenced user's title (email)
  assert.equal(list.resolved.fkLabels.author_id.u1, 'alice@x.com')
})

test('list rows are projected to the visible columns (no hidden leak)', async () => {
  const view = defineView({ sections: crudBlocks({ table: 'posts' }) })
  const out = await hydrateView(view, { tables: tables(), db })
  const row = out.sections.find((s) => s.block === 'list').resolved.rows[0]
  assert.ok(!('created_at' in row)) // a hidden column never ships
  assert.ok('title' in row)
})

test('row scoping bounds the list to the owner’s rows', async () => {
  const scope = (table) => (table === 'posts' ? { user_id: 'u1' } : {})
  const view = defineView({ sections: crudBlocks({ table: 'posts' }) })
  const out = await hydrateView(view, { tables: tables(), db, scope })
  const list = out.sections.find((s) => s.block === 'list')
  assert.equal(list.resolved.total, 1)
  assert.deepEqual(list.resolved.rows.map((r) => r.title), ['Alice One'])
})

test('a record block with an id fills its row', async () => {
  const view = defineView({ sections: [{ block: 'record', table: 'posts', id: 'p1' }] })
  const out = await hydrateView(view, { tables: tables(), db })
  assert.equal(out.sections[0].resolved.row.title, 'Alice One')
})

test('createRow inserts, fills a uuid pk, and forces the owner scope', async () => {
  const fields = [{ name: 'title', type: 'text' }, { name: 'user_id', type: 'text' }]
  const scope = () => ({ user_id: 'u1' })
  // a forged user_id in the form is overwritten by the scope
  const row = await createRow(db, tables(), 'posts', fields, form({ title: 'New', user_id: 'u2' }), { scope })
  assert.equal(row.user_id, 'u1')
  assert.ok(row.id) // generated
  assert.equal((await db.posts.findOne({ id: row.id })).title, 'New')
})

test('updateRow and deleteRow are keyed by pk AND scope (can’t touch another owner’s row)', async () => {
  const fields = [{ name: 'title', type: 'text' }]
  const scope = () => ({ user_id: 'u1' })
  // p2 belongs to u2 -> a u1-scoped update/delete matches nothing
  const updated = await updateRow(db, tables(), 'posts', fields, 'p2', form({ title: 'Hacked' }), { scope })
  assert.equal(updated, null)
  assert.equal((await db.posts.findOne({ id: 'p2' })).title, 'Bob One') // untouched
  const deleted = await deleteRow(db, tables(), 'posts', 'p2', { scope })
  assert.equal(deleted, 0)
  // own row updates fine
  const own = await updateRow(db, tables(), 'posts', fields, 'p1', form({ title: 'Renamed' }), { scope })
  assert.equal(own.title, 'Renamed')
})
