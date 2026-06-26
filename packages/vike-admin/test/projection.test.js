// #228 — the HTML data hooks must project rows to the visible columns BEFORE returning, so a
// hidden column (a password_hash, an unlisted secret) never reaches the client hydration
// payload. The JSON agent API already projected; the HTML list/edit hooks shipped the whole
// row. These pin that both `listData.rows` and `editData.values` are narrowed to the visible
// set (+pk) over the memory adapter, with no Vike/React.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineResource, column } from '../define.js'
import { resolveAdminTables, buildDb } from '../resolve.js'
import { listData, editData } from '../data.js'

// A table with a SECRET column (`password_hash`, hidden by the `*_hash` convention) and a
// column the resource doesn't list (`active`), alongside the conventionally-hidden id +
// timestamps. The resource only exposes email + name.
const usersSchema = defineSchema('users', (t) => {
  t.uuid('id').primary()
  t.string('email').unique()
  t.string('name').nullable()
  t.string('password_hash')
  t.boolean('active').default(true)
  t.timestamps()
})

const resource = defineResource({ table: 'users', list: [column('email'), column('name')], form: [column('email'), column('name')] })
const config = { schemas: [usersSchema], adminResources: [resource] }

beforeEach(async () => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
  const db = buildDb(resolveAdminTables(config))
  await db.users.insert({
    id: 'u0',
    email: 'a@b.com',
    name: 'A',
    password_hash: 'super-secret-hash',
    active: true,
    created_at: 'now',
    updated_at: 'now',
  })
})

test('listData rows are projected to the visible columns + pk (no password_hash leak)', async () => {
  const data = await listData({ routeParams: { table: 'users' }, config, user: { role: 'admin' }, urlParsed: { search: {} } })
  assert.equal(data.rows.length, 1)
  const row = data.rows[0]
  // Only the listed columns and the primary key survive.
  assert.deepEqual(Object.keys(row).sort(), ['email', 'id', 'name'])
  // The secret and unlisted/hidden columns are gone.
  assert.equal('password_hash' in row, false)
  assert.equal('active' in row, false)
  assert.equal('created_at' in row, false)
  assert.equal(row.email, 'a@b.com') // visible data still present
})

test('editData values are projected to the form fields + pk (no password_hash leak)', async () => {
  const data = await editData({ routeParams: { table: 'users', id: 'u0' }, config, user: { role: 'admin' } })
  assert.ok(data.values, 'the row loaded')
  assert.equal('password_hash' in data.values, false)
  assert.equal('active' in data.values, false)
  assert.equal('created_at' in data.values, false)
  assert.equal(data.values.email, 'a@b.com') // the form still pre-fills its fields
  assert.equal(data.values.name, 'A')
})
