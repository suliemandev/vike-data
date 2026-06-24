// FK option scoping (#141): a foreign-key <select> (and the list's FK label map) must not
// enumerate the WHOLE referenced table for a scoped, non-admin user — that crosses the same
// row-scope boundary the rest of the module enforces and serializes the target rows (often
// emails / names) into the page view-model. The FK lookup is bounded by the TARGET resource's
// own `scope(user)`: a user only sees, in an FK dropdown, rows they could see in that table.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineResource } from '../define.js'
import { resolveAdminTables, buildDb } from '../resolve.js'
import { listData, newData, editData } from '../data.js'

const usersSchema = defineSchema('users', (t) => {
  t.uuid('id').primary()
  t.string('email')
})

const projectsSchema = defineSchema('projects', (t) => {
  t.uuid('id').primary()
  t.uuid('owner_id').references('users.id')
  t.string('name')
})

// users is the FK TARGET and is itself scoped: a non-admin sees only their own user row.
const users = defineResource({ table: 'users', recordTitle: 'email', scope: (u) => (u?.role === 'admin' ? null : { id: u.id }) })
// projects is unscoped, so a non-admin can open its create/edit form and hit the FK lookup.
const projects = defineResource({ table: 'projects' })
const config = { schemas: [usersSchema, projectsSchema], adminResources: [users, projects] }

const USER = { id: 'u1', role: 'user' }
const ADMIN = { id: 'admin', role: 'admin' }

const ctx = (user, routeParams = { table: 'projects' }, search = {}) => ({ routeParams, config, user, urlParsed: { search } })
const freshDb = () => buildDb(resolveAdminTables(config))

async function seed() {
  const db = freshDb()
  await db.users.insert({ id: 'u1', email: 'u1@example.com' })
  await db.users.insert({ id: 'u2', email: 'u2@example.com' })
  await db.users.insert({ id: 'admin', email: 'admin@example.com' })
  await db.projects.insert({ id: 'p1', owner_id: 'u1', name: 'mine' })
  await db.projects.insert({ id: 'p2', owner_id: 'u2', name: 'theirs' })
}

const ownerOptions = (data) => data.fields.find((f) => f.name === 'owner_id').options.map((o) => o.value).sort()

beforeEach(() => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
})

test('create form: a scoped user only sees in-scope rows in the FK dropdown', async () => {
  await seed()
  const data = await newData(ctx(USER))
  assert.deepEqual(ownerOptions(data), ['u1']) // only their own user row, not u2/admin
})

test('create form: an admin (scope null) sees every row in the FK dropdown', async () => {
  await seed()
  const data = await newData(ctx(ADMIN))
  assert.deepEqual(ownerOptions(data), ['admin', 'u1', 'u2'])
})

test('edit form: the FK dropdown is bounded by the target scope too', async () => {
  await seed()
  const data = await editData(ctx(USER, { table: 'projects', id: 'p1' }))
  assert.deepEqual(ownerOptions(data), ['u1'])
})

test('list: the FK label map only includes in-scope target rows (no email leak)', async () => {
  await seed()
  const scoped = await listData(ctx(USER))
  // u1 is the user's own row -> labelled; u2 is out of scope -> absent (cell falls back to raw key).
  assert.deepEqual(scoped.fkLabels.owner_id, { u1: 'u1@example.com' })
  assert.equal(scoped.fkLabels.owner_id.u2, undefined)

  const asAdmin = await listData(ctx(ADMIN))
  assert.equal(asAdmin.fkLabels.owner_id.u2, 'u2@example.com') // admin sees all labels
})

test('an FK to a table with no registered resource is unbounded (additive, original behaviour)', async () => {
  // Drop the users resource: the FK target is now an un-scoped, un-registered table.
  const cfg = { schemas: [usersSchema, projectsSchema], adminResources: [projects] }
  clearAdapter()
  setAdapter(createMemoryAdapter())
  const db = buildDb(resolveAdminTables(cfg))
  await db.users.insert({ id: 'u1', email: 'u1@example.com' })
  await db.users.insert({ id: 'u2', email: 'u2@example.com' })
  const data = await newData({ routeParams: { table: 'projects' }, config: cfg, user: USER, urlParsed: { search: {} } })
  assert.deepEqual(data.fields.find((f) => f.name === 'owner_id').options.map((o) => o.value).sort(), ['u1', 'u2'])
})
