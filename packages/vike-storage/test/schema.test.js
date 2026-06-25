import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uploadsSchema, uploadsSchemaFor } from '../schema.js'

// The `uploads` table vike-storage owns (the Stem pattern). Pins the fragment the upload
// store + the admin file widget read, so the user_id FK + storage_key uniqueness can't
// silently drift from the schema that creates the table.

const col = (name) => uploadsSchema.columns.find((c) => c.name === name)

test('it is a create fragment for uploads', () => {
  assert.equal(uploadsSchema.mode, 'create')
  assert.equal(uploadsSchema.table, 'uploads')
})

test('user_id references users.id with onDelete cascade', () => {
  const c = col('user_id')
  assert.equal(c.type, 'uuid')
  assert.deepEqual(c.references, { table: 'users', column: 'id' })
  assert.equal(c.onDelete, 'cascade')
})

test('storage_key is a unique string (one row per stored object)', () => {
  const c = col('storage_key')
  assert.equal(c.type, 'string')
  assert.equal(c.unique, true)
})

test('the FK target follows a renamed vike-auth subject table (the FK column stays user_id)', () => {
  // vike-auth's subject table is configurable (VIKE_AUTH_USERS_TABLE); the FK target has to
  // follow it or the migration points at a users table that was never created.
  const renamed = uploadsSchemaFor('members')
  const fk = renamed.columns.find((c) => c.name === 'user_id')
  assert.deepEqual(fk.references, { table: 'members', column: 'id' })
})
