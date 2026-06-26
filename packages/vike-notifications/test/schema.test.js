import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notificationsSchema, notificationsSchemaFor } from '../schema.js'

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
