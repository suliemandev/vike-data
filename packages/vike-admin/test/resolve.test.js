// The core of vike-admin, exercised without Vike or React: schema-default derivation,
// the auto-hide convention, resource refinements, and the insert round-trip through
// universal-orm on the memory adapter (the same adapter the demo and every other
// extension test run on).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineResource, column, field } from '../define.js'
import { resolveAdminTables, viewColumns, viewFields, buildDb, getResources, recordTitleColumn, tableNamed } from '../resolve.js'

const usersSchema = defineSchema('users', (t) => {
  t.uuid('id').primary()
  t.string('email').unique()
  t.string('name').nullable()
  t.string('password_hash').nullable()
  t.boolean('active').default(true)
  t.timestamps()
})

const config = (resources) => ({ schemas: [usersSchema], adminResources: resources })
const usersTable = () => resolveAdminTables(config([]))[0]

beforeEach(() => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
})

test('resolveAdminTables merges the cumulative schemas into tables', () => {
  const table = usersTable()
  assert.equal(table.table, 'users')
  assert.deepEqual(
    table.columns.map((c) => c.name),
    ['id', 'email', 'name', 'password_hash', 'active', 'created_at', 'updated_at'],
  )
})

test('viewColumns defaults from the schema and auto-hides id / *_hash / timestamps', () => {
  const cols = viewColumns(defineResource({ table: 'users' }), usersTable())
  assert.deepEqual(
    cols.map((c) => c.name),
    ['email', 'name', 'active'],
  )
  // labels are title-cased, types come from the schema
  assert.equal(cols[0].label, 'Email')
  assert.equal(cols.find((c) => c.name === 'active').type, 'boolean')
})

test('viewColumns honors an explicit list and resolves type/format from the schema', () => {
  const resource = defineResource({
    table: 'users',
    list: [column('email').sortable().searchable(), column('created_at').format('since').label('Joined')],
  })
  const cols = viewColumns(resource, usersTable())
  assert.deepEqual(
    cols.map((c) => c.name),
    ['email', 'created_at'],
  )
  assert.equal(cols[0].sortable, true)
  assert.equal(cols[0].searchable, true)
  assert.equal(cols[1].label, 'Joined')
  assert.equal(cols[1].format, 'since')
  assert.equal(cols[1].type, 'timestamp')
})

test('viewFields defaults from the schema, auto-hides, and infers required from non-null/no-default', () => {
  const fields = viewFields(defineResource({ table: 'users' }), usersTable())
  assert.deepEqual(
    fields.map((f) => f.name),
    ['email', 'name', 'active'],
  )
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]))
  assert.equal(byName.email.required, true) // non-null, no default
  assert.equal(byName.name.required, false) // nullable
  assert.equal(byName.active.required, false) // has a default
  assert.equal(byName.active.type, 'boolean')
})

test('viewFields honors an explicit form and lets a field override the inferred type', () => {
  const resource = defineResource({
    table: 'users',
    form: [field('email').type('email').required(), field('name')],
  })
  const fields = viewFields(resource, usersTable())
  assert.equal(fields[0].type, 'email')
  assert.equal(fields[0].required, true)
  assert.equal(fields[1].name, 'name')
  assert.equal(fields[1].required, false)
})

test('getResources returns the contributed resources whole (functions intact)', () => {
  const resource = defineResource({ table: 'users', canEdit: (u) => u?.role === 'admin' })
  const resources = getResources(config([resource]))
  assert.equal(resources.length, 1)
  assert.equal(resources[0].canEdit({ role: 'admin' }), true)
  assert.equal(resources[0].canEdit({ role: 'user' }), false)
})

test('insert round-trip: buildDb inserts a row and find returns it', async () => {
  const tables = resolveAdminTables(config([]))
  const db = buildDb(tables)
  assert.deepEqual(await db.users.find({}), [])

  await db.users.insert({ id: 'u1', email: 'ada@example.com', name: 'Ada', active: true })
  const rows = await db.users.find({})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].email, 'ada@example.com')
})

test('buildDb rejects an unknown column (the schema is the source of truth)', async () => {
  const db = buildDb(resolveAdminTables(config([])))
  await assert.rejects(async () => db.users.insert({ id: 'u2', emial: 'typo@example.com' }), /unknown column "emial"/)
})

test('edit round-trip: update by primary key patches the row', async () => {
  const db = buildDb(resolveAdminTables(config([])))
  await db.users.insert({ id: 'u1', email: 'ada@example.com', name: 'Ada', active: true })

  await db.users.update({ id: 'u1' }, { name: 'Ada Lovelace', active: false })
  const row = await db.users.findOne({ id: 'u1' })
  assert.equal(row.name, 'Ada Lovelace')
  assert.equal(row.active, false)
  assert.equal(row.email, 'ada@example.com') // untouched
})

test('delete round-trip: delete by primary key removes the row', async () => {
  const db = buildDb(resolveAdminTables(config([])))
  await db.users.insert({ id: 'u1', email: 'ada@example.com' })
  await db.users.insert({ id: 'u2', email: 'alan@example.com' })

  const removed = await db.users.delete({ id: 'u1' })
  assert.equal(removed, 1)
  const rows = await db.users.find({})
  assert.deepEqual(
    rows.map((r) => r.id),
    ['u2'],
  )
})

// --- foreign-key fields -----------------------------------------------------------------

const sessionsSchema = defineSchema('sessions', (t) => {
  t.uuid('id').primary()
  t.uuid('user_id').references('users.id', { onDelete: 'cascade' })
  t.string('token')
  t.timestamps()
})
const fkConfig = (resources) => ({ schemas: [usersSchema, sessionsSchema], adminResources: resources })
const sessionsTable = () => tableNamed(resolveAdminTables(fkConfig([])), 'sessions')

test('viewFields marks a foreign-key column as a select carrying its fk target', () => {
  const fields = viewFields(defineResource({ table: 'sessions' }), sessionsTable())
  const userId = fields.find((f) => f.name === 'user_id')
  assert.equal(userId.type, 'select')
  assert.deepEqual(userId.fk, { table: 'users', column: 'id' })
  // a non-FK column stays a plain input
  assert.equal(fields.find((f) => f.name === 'token').fk, undefined)
  // an FK's widget is the select widget too
  assert.equal(userId.widget, 'select')
})

// --- semantic widgets (#176 -> #177) ----------------------------------------------------

const docsSchema = defineSchema('docs', (t) => {
  t.uuid('id').primary()
  t.string('contact').as('email')
  t.text('body').as('longtext')
  t.string('status').as('enum', { values: ['draft', 'published'] })
  t.string('avatar').as('file') // a token no built-in widget owns
  t.string('plain') // no semantic
  t.integer('rank')
})
const docsConfig = (resources) => ({ schemas: [docsSchema], adminResources: resources })
const docsTable = () => tableNamed(resolveAdminTables(docsConfig([])), 'docs')

test('viewFields derives the widget from a column semantic, leaving the coercion type intact', () => {
  const fields = viewFields(defineResource({ table: 'docs' }), docsTable())
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]))
  // a string column marked .as('email') renders as email but still coerces as text
  assert.equal(byName.contact.widget, 'email')
  assert.equal(byName.contact.type, 'text')
  assert.equal(byName.body.widget, 'longtext')
  assert.equal(byName.status.widget, 'enum')
  // an unknown semantic passes through as the widget token (FormFields falls back to text)
  assert.equal(byName.avatar.widget, 'file')
})

test('a column without a semantic keeps widget === its coercion type (back-compat)', () => {
  const byName = Object.fromEntries(viewFields(defineResource({ table: 'docs' }), docsTable()).map((f) => [f.name, f]))
  assert.equal(byName.plain.widget, 'text')
  assert.equal(byName.plain.type, 'text')
  assert.equal(byName.rank.widget, 'integer')
  assert.equal(byName.rank.type, 'integer')
})

test('an enum semantic surfaces its values as static select options', () => {
  const status = viewFields(defineResource({ table: 'docs' }), docsTable()).find((f) => f.name === 'status')
  assert.deepEqual(status.options, [
    { value: 'draft', label: 'draft' },
    { value: 'published', label: 'published' },
  ])
})

test('an explicit field .type() override wins over the column semantic for both type and widget', () => {
  const resource = defineResource({ table: 'docs', form: [field('contact').type('text')] })
  const contact = viewFields(resource, docsTable())[0]
  assert.equal(contact.type, 'text')
  assert.equal(contact.widget, 'text')
  assert.equal(contact.options, undefined)
})

test('recordTitleColumn honors a resource recordTitle, else falls back to a string column', () => {
  const usersTbl = resolveAdminTables(fkConfig([]))[0]
  assert.equal(recordTitleColumn(defineResource({ table: 'users', recordTitle: 'email' }), usersTbl), 'email')
  // no resource / no recordTitle -> first non-hidden string column
  assert.equal(recordTitleColumn(null, usersTbl), 'email')
})
