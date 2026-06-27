import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notificationsSchema, notificationsSchemaFor, notificationsSchemas } from '../schema.js'
import { defineGuard } from 'vike-auth/guards'

// The `notifications` table vike-notifications owns (the Stem pattern). Pins the fragment
// the database channel + feed read helpers depend on, so the user_id FK + read_at contract
// can't silently drift from the schema that creates the table.

const col = (name) => notificationsSchema.columns.find((c) => c.name === name)

test('it is a create fragment for notifications', () => {
  assert.equal(notificationsSchema.mode, 'create')
  assert.equal(notificationsSchema.table, 'notifications')
})

test('id is a primary uuid', () => {
  assert.equal(col('id').type, 'uuid')
  assert.equal(col('id').primary, true)
})

test('user_id references users.id with onDelete cascade', () => {
  const c = col('user_id')
  assert.equal(c.type, 'uuid')
  assert.deepEqual(c.references, { table: 'users', column: 'id' })
  assert.equal(c.onDelete, 'cascade')
})

test('type and data are strings (data is a JSON string)', () => {
  assert.equal(col('type').type, 'string')
  assert.equal(col('data').type, 'string')
})

test('read_at is a nullable timestamp (null = unread)', () => {
  assert.equal(col('read_at').type, 'timestamp')
  assert.equal(col('read_at').nullable, true)
})

test('timestamps() adds created_at + updated_at defaulting to now', () => {
  assert.deepEqual(
    ['created_at', 'updated_at'].map((n) => [col(n)?.type, col(n)?.default]),
    [['timestamp', 'now'], ['timestamp', 'now']],
  )
})

test('the FK target follows a renamed vike-auth subject table (the FK column stays user_id)', () => {
  // vike-auth's subject table is configurable (VIKE_AUTH_SUBJECT_TABLE); the FK target has to
  // follow it or the migration points at a users table that was never created.
  const renamed = notificationsSchemaFor('members')
  const fk = renamed.columns.find((c) => c.name === 'user_id')
  assert.deepEqual(fk.references, { table: 'members', column: 'id' })
})

// The config-aware `schemas` contribution (#279 / #207 P3): the FK target follows the guard the
// app bound notifications to via `config.notificationsGuard`, defaulting to the default `users`
// subject so an app that sets nothing is byte-for-byte unchanged.
const notificationsFkOf = (config) => notificationsSchemas(config)[0].columns.find((c) => c.name === 'user_id')

test('notificationsSchemas() defaults the FK target to the default users subject', () => {
  assert.deepEqual(notificationsFkOf(undefined).references, { table: 'users', column: 'id' })
  assert.deepEqual(notificationsFkOf({}).references, { table: 'users', column: 'id' })
})

test('notificationsSchemas({ notificationsGuard }) targets the named guard subject table', () => {
  // A customer (client) guard owns its own `clients` subject; binding notifications to it points
  // the feed FK at `clients`, not the default `users`.
  defineGuard('client', { table: 'clients' })
  assert.deepEqual(notificationsFkOf({ notificationsGuard: 'client' }).references, { table: 'clients', column: 'id' })
})

test("notificationsSchemas({ notificationsGuard: 'default' }) is the default users subject", () => {
  // The default subject is itself a guard (#276); naming it explicitly resolves to `users`.
  assert.deepEqual(notificationsFkOf({ notificationsGuard: 'default' }).references, { table: 'users', column: 'id' })
})

test('notificationsSchemas falls back to the default subject for an unregistered guard name', () => {
  // Never mint an FK to a table no guard owns: an unknown name degrades to the default subject
  // rather than a dangling reference.
  assert.deepEqual(notificationsFkOf({ notificationsGuard: 'never-registered' }).references, { table: 'users', column: 'id' })
})

// The #250 owner binding: `notificationsOwner` swaps the owner COLUMN + table so the feed can be
// owned by an organization, not just a user. Orthogonal to `notificationsGuard` (which picks WHICH
// user subject table). The owner FK is the single column carrying `references`.
const ownerFkOf = (config) => notificationsSchemas(config)[0].columns.find((c) => c.references)

test('notificationsSchemas defaults to owning by user_id on the default subject (unchanged)', () => {
  const fk = ownerFkOf(undefined)
  assert.equal(fk.name, 'user_id')
  assert.deepEqual(fk.references, { table: 'users', column: 'id' })
})

test('notificationsSchemas({ notificationsOwner }) owns by organization_id on organizations', () => {
  const fk = ownerFkOf({ notificationsOwner: { table: 'organizations', column: 'organization_id' } })
  assert.equal(fk.name, 'organization_id')
  assert.deepEqual(fk.references, { table: 'organizations', column: 'id' })
})

test('the owner binding table wins over the guard subject table', () => {
  // notificationsGuard picks WHICH user table; an org owner binding overrides the table entirely.
  // With both set, the owner binding is the FK target — org ownership supersedes the per-guard user.
  defineGuard('owner-client', { table: 'clients' })
  const fk = ownerFkOf({ notificationsGuard: 'owner-client', notificationsOwner: { table: 'organizations', column: 'organization_id' } })
  assert.equal(fk.name, 'organization_id')
  assert.deepEqual(fk.references, { table: 'organizations', column: 'id' })
})

test('a column-only owner binding keeps the subject table, owns by the given column', () => {
  const fk = ownerFkOf({ notificationsOwner: { column: 'account_id' } })
  assert.equal(fk.name, 'account_id')
  assert.deepEqual(fk.references, { table: 'users', column: 'id' })
})
