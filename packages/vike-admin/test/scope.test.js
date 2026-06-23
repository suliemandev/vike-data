// Row scoping (#104): a resource's `scope(user) -> filter` bounds every admin row op to the
// user's own rows. Exercised through the real data hooks (listData / newData / editData) on the
// memory adapter. The security-critical assertions: a scoped user can only see, create, edit and
// delete their own rows, and cannot reassign ownership.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineResource } from '../define.js'
import { resolveAdminTables, buildDb } from '../resolve.js'
import { listData, newData, editData } from '../data.js'

const notesSchema = defineSchema('notes', (t) => {
  t.uuid('id').primary()
  t.uuid('user_id')
  t.string('title')
})

// Admins (role 'admin') bypass scoping; everyone else is bound to their own user_id.
const notes = defineResource({ table: 'notes', scope: (u) => (u?.role === 'admin' ? null : { user_id: u.id }) })
const config = { schemas: [notesSchema], adminResources: [notes] }

const USER = { id: 'u1', role: 'user' }
const ADMIN = { id: 'admin', role: 'admin' }

const getCtx = (user, routeParams = { table: 'notes' }, search = {}) => ({ routeParams, config, user, urlParsed: { search } })

function postCtx(form, routeParams, user) {
  const body = new URLSearchParams(form).toString()
  const req = new Request('http://localhost/admin', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  })
  return { routeParams, config, user, urlParsed: { search: {} }, _reqWeb: req }
}

const freshDb = () => buildDb(resolveAdminTables(config))

async function seed() {
  const db = freshDb()
  await db.notes.insert({ id: 'n1', user_id: 'u1', title: 'a' })
  await db.notes.insert({ id: 'n2', user_id: 'u1', title: 'b' })
  await db.notes.insert({ id: 'n3', user_id: 'u2', title: 'c' }) // someone else's
}

beforeEach(() => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
})

test('list: a scoped user sees only their own rows, and the total reflects the scope', async () => {
  await seed()
  const data = await listData(getCtx(USER))
  assert.equal(data.total, 2)
  assert.deepEqual(data.rows.map((r) => r.id).sort(), ['n1', 'n2'])
})

test('list: an admin (scope returns null) sees every row', async () => {
  await seed()
  const data = await listData(getCtx(ADMIN))
  assert.equal(data.total, 3)
})

test('create: ownership is forced, a forged user_id in the form is overwritten', async () => {
  await seed()
  // id is auto-hidden from the form (a uuid is generated), so look the row up by title.
  await assert.rejects(newData(postCtx({ user_id: 'u2', title: 'forged' }, { table: 'notes' }, USER))) // redirects on success
  const rows = await freshDb().notes.find({ title: 'forged' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, 'u1') // forced to the creator, not the forged u2
})

test('edit load: own row loads; another owner’s row bounces (redirect)', async () => {
  await seed()
  const own = await editData(getCtx(USER, { table: 'notes', id: 'n1' }))
  assert.equal(own.values.id, 'n1')
  await assert.rejects(editData(getCtx(USER, { table: 'notes', id: 'n3' }))) // u2's note -> not found -> redirect
})

test('update: editing another owner’s row by guessing its id is a no-op', async () => {
  await seed()
  await assert.rejects(editData(postCtx({ title: 'hacked' }, { table: 'notes', id: 'n3' }, USER))) // redirects
  assert.equal((await freshDb().notes.findOne({ id: 'n3' })).title, 'c') // unchanged
})

test('update: a user cannot reassign ownership of their own row', async () => {
  await seed()
  await assert.rejects(editData(postCtx({ user_id: 'u2', title: 'mine2' }, { table: 'notes', id: 'n1' }, USER)))
  const row = await freshDb().notes.findOne({ id: 'n1' })
  assert.equal(row.user_id, 'u1') // ownership preserved
  assert.equal(row.title, 'mine2') // the legit field still updated
})

test('delete: deleting another owner’s row by guessing its id is a no-op', async () => {
  await seed()
  await assert.rejects(editData(postCtx({ _action: 'delete' }, { table: 'notes', id: 'n3' }, USER))) // redirects
  assert.ok(await freshDb().notes.findOne({ id: 'n3' })) // still there
})

test('delete: a user can delete their own row', async () => {
  await seed()
  await assert.rejects(editData(postCtx({ _action: 'delete' }, { table: 'notes', id: 'n1' }, USER)))
  assert.equal(await freshDb().notes.findOne({ id: 'n1' }), null)
})
