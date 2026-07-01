// vike-view's framework-agnostic core, exercised without Vike or React: crud, the
// schema-default derivation for list / record / form, the auto-hide convention, semantic
// widgets, FK-aware fields, projection, and the validated list query. This is the core the
// vike-admin preset (and every future renderer) consumes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import {
  crud,
  column,
  display,
  field,
  resolveViewTables,
  viewColumns,
  viewRecord,
  viewFields,
  recordTitleColumn,
  tableNamed,
  projectRow,
  parseListQuery,
  QueryError,
} from '../index.js'

const usersSchema = defineSchema('users', (t) => {
  t.uuid('id').primary()
  t.string('email').unique().as('email')
  t.string('name').nullable()
  t.string('password_hash').nullable()
  t.string('role').as('enum', { values: ['admin', 'member'] })
  t.boolean('active').default(true)
  t.timestamps()
})

const postsSchema = defineSchema('posts', (t) => {
  t.uuid('id').primary()
  t.string('title')
  t.text('body').nullable()
  t.uuid('author_id').references('users.id', { onDelete: 'cascade' })
  t.timestamps()
})

const config = { schemas: [usersSchema, postsSchema] }
const tables = () => resolveViewTables(config)
const usersTable = () => tableNamed(tables(), 'users')
const postsTable = () => tableNamed(tables(), 'posts')

// --- crud ---------------------------------------------------------------

test('crud requires a table name and defaults icon to null', () => {
  assert.throws(() => crud(), /expected a definition object/)
  assert.throws(() => crud({}), /`table`.*is required/)
  assert.deepEqual(crud({ table: 'posts' }), { icon: null, table: 'posts' })
})

// --- list ---------------------------------------------------------------------

test('viewColumns defaults from the schema and auto-hides id / *_hash / timestamps', () => {
  const cols = viewColumns(crud({ table: 'users' }), usersTable())
  assert.deepEqual(cols.map((c) => c.name), ['email', 'name', 'role', 'active'])
  assert.equal(cols[0].label, 'Email')
  assert.equal(cols.find((c) => c.name === 'active').type, 'boolean')
})

test('viewColumns honors an explicit list with refinements', () => {
  const cols = viewColumns(
    crud({ table: 'users', list: [column('email').sortable().searchable(), column('created_at').format('since').label('Joined')] }),
    usersTable(),
  )
  assert.deepEqual(cols.map((c) => c.name), ['email', 'created_at'])
  assert.equal(cols[0].sortable, true)
  assert.equal(cols[0].searchable, true)
  assert.equal(cols[1].label, 'Joined')
  assert.equal(cols[1].format, 'since')
})

// --- record (the new read-only detail view) -----------------------------------

test('viewRecord defaults to every non-hidden column, read-only, with widgets from the schema', () => {
  const fields = viewRecord(crud({ table: 'users' }), usersTable())
  assert.deepEqual(fields.map((f) => f.name), ['email', 'name', 'role', 'active'])
  // no `required` on a read-only detail view
  assert.ok(fields.every((f) => !('required' in f)))
  // semantic hints drive the widget (email / enum), storage type stays intact
  assert.equal(fields.find((f) => f.name === 'email').widget, 'email')
  assert.equal(fields.find((f) => f.name === 'role').widget, 'enum')
  assert.equal(fields.find((f) => f.name === 'active').widget, 'boolean')
})

test('viewRecord honors an explicit record selection with label/format refinements', () => {
  const fields = viewRecord(
    crud({ table: 'users', record: [display('email').label('Contact'), display('created_at').format('since')] }),
    usersTable(),
  )
  assert.deepEqual(fields.map((f) => f.name), ['email', 'created_at'])
  assert.equal(fields[0].label, 'Contact')
  assert.equal(fields[1].format, 'since')
})

test('viewRecord carries fk info so a renderer can show the referenced row title', () => {
  const authorField = viewRecord(crud({ table: 'posts' }), postsTable()).find((f) => f.name === 'author_id')
  assert.deepEqual(authorField.fk, { table: 'users', column: 'id' })
})

// --- form ---------------------------------------------------------------------

test('viewFields infers required, widgets, and marks a foreign key as a select', () => {
  const fields = viewFields(crud({ table: 'posts' }), postsTable())
  const title = fields.find((f) => f.name === 'title')
  const body = fields.find((f) => f.name === 'body')
  const author = fields.find((f) => f.name === 'author_id')
  assert.equal(title.required, true) // non-null, no default
  assert.equal(body.required, false) // nullable
  assert.equal(author.type, 'select')
  assert.deepEqual(author.fk, { table: 'users', column: 'id' })
})

test('viewFields surfaces enum semantic values as static select options', () => {
  const role = viewFields(crud({ table: 'users' }), usersTable()).find((f) => f.name === 'role')
  assert.equal(role.widget, 'enum')
  assert.deepEqual(role.options, [
    { value: 'admin', label: 'admin' },
    { value: 'member', label: 'member' },
  ])
})

test('an explicit field .type() override wins over the column semantic', () => {
  const email = viewFields(crud({ table: 'users', form: [field('email').type('text')] }), usersTable())[0]
  assert.equal(email.type, 'text')
  assert.equal(email.widget, 'text')
})

// --- misc core ----------------------------------------------------------------

test('recordTitleColumn honors recordTitle, else the first string column', () => {
  assert.equal(recordTitleColumn(crud({ table: 'users' }), usersTable()), 'email')
  assert.equal(recordTitleColumn(crud({ table: 'users', recordTitle: 'name' }), usersTable()), 'name')
})

test('projectRow narrows a row to the visible columns plus the primary key', () => {
  const row = { id: 'u1', email: 'a@b.c', password_hash: 'secret', name: 'A' }
  const out = projectRow(row, { columns: [{ name: 'email' }, { name: 'name' }], pk: 'id' })
  assert.deepEqual(out, { id: 'u1', email: 'a@b.c', name: 'A' })
  assert.ok(!('password_hash' in out))
})

test('parseListQuery validates against the view columns and rejects unknown/unsortable', () => {
  const cols = [{ name: 'email', sortable: true }, { name: 'name' }]
  assert.deepEqual(parseListQuery('{"filter":{"email":"a@b.c"}}', cols), { filter: { email: 'a@b.c' } })
  assert.throws(() => parseListQuery('{"filter":{"nope":1}}', cols), QueryError)
  assert.throws(() => parseListQuery('{"orderBy":"name"}', cols), /not sortable/)
})
