import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uploadsSchema, uploadsSchemaFor, uploadsSchemas } from '../schema.js'
import { defineGuard } from 'vike-auth/guards'

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
  // vike-auth's subject table is configurable (VIKE_AUTH_SUBJECT_TABLE); the FK target has to
  // follow it or the migration points at a users table that was never created.
  const renamed = uploadsSchemaFor('members')
  const fk = renamed.columns.find((c) => c.name === 'user_id')
  assert.deepEqual(fk.references, { table: 'members', column: 'id' })
})

// The config-aware `schemas` contribution (#278 / #207 P3): the FK target follows the guard
// the app bound storage to via `config.storageGuard`, defaulting to the default `users`
// subject so an app that sets nothing is byte-for-byte unchanged.
const uploadsFkOf = (config) => uploadsSchemas(config)[0].columns.find((c) => c.name === 'user_id')

test('uploadsSchemas() defaults the FK target to the default users subject', () => {
  assert.deepEqual(uploadsFkOf(undefined).references, { table: 'users', column: 'id' })
  assert.deepEqual(uploadsFkOf({}).references, { table: 'users', column: 'id' })
})

test('uploadsSchemas({ storageGuard }) targets the named guard subject table', () => {
  // A staff (admin) guard owns its own `admins` subject; binding storage to it points the
  // uploads FK at `admins`, not the default `users`.
  defineGuard('admin', { table: 'admins' })
  assert.deepEqual(uploadsFkOf({ storageGuard: 'admin' }).references, { table: 'admins', column: 'id' })
})

test("uploadsSchemas({ storageGuard: 'default' }) is the default users subject", () => {
  // The default subject is itself a guard (#276); naming it explicitly resolves to `users`.
  assert.deepEqual(uploadsFkOf({ storageGuard: 'default' }).references, { table: 'users', column: 'id' })
})

test('uploadsSchemas falls back to the default subject for an unregistered guard name', () => {
  // Never mint an FK to a table no guard owns: an unknown name degrades to the default
  // subject rather than a dangling reference.
  assert.deepEqual(uploadsFkOf({ storageGuard: 'never-registered' }).references, { table: 'users', column: 'id' })
})
