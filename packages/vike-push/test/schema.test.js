import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushSubscriptionsSchema, pushSubscriptionsSchemaFor, pushSubscriptionsSchemas } from '../schema.js'

// The push_subscriptions table vike-push owns (the Stem pattern). These pin the
// fragment shape the merge/derive layers read, so the columns + the user_id FK +
// the endpoint uniqueness can't silently drift.

const col = (name) => pushSubscriptionsSchema.columns.find((c) => c.name === name)

test('it is a create fragment for push_subscriptions', () => {
  assert.equal(pushSubscriptionsSchema.mode, 'create')
  assert.equal(pushSubscriptionsSchema.table, 'push_subscriptions')
})

test('id is a primary uuid', () => {
  const c = col('id')
  assert.equal(c.type, 'uuid')
  assert.equal(c.primary, true)
})

test('user_id references users.id with onDelete cascade', () => {
  const c = col('user_id')
  assert.equal(c.type, 'uuid')
  assert.deepEqual(c.references, { table: 'users', column: 'id' })
  assert.equal(c.onDelete, 'cascade')
})

test('endpoint is a unique string (re-subscribing updates the same row)', () => {
  const c = col('endpoint')
  assert.equal(c.type, 'string')
  assert.equal(c.unique, true)
})

test('the encryption material is stored as p256dh + auth_secret strings', () => {
  // auth_secret, not `auth`, to avoid `auth` as a column identifier across ORMs.
  assert.equal(col('p256dh').type, 'string')
  assert.equal(col('auth_secret').type, 'string')
  assert.equal(col('auth'), undefined)
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
  const renamed = pushSubscriptionsSchemaFor('members')
  const fk = renamed.columns.find((c) => c.name === 'user_id')
  assert.deepEqual(fk.references, { table: 'members', column: 'id' })
})

// The #250 owner binding: `pushOwner` swaps the owner COLUMN + table so a subscription can be
// owned by an organization, not just a user. The owner FK is the single column carrying
// `references` (id is primary, endpoint is unique-but-unreferenced).
const ownerFkOf = (config) => pushSubscriptionsSchemas(config)[0].columns.find((c) => c.references)

test('pushSubscriptionsSchemas defaults to owning by user_id on the default subject (unchanged)', () => {
  const fk = ownerFkOf(undefined)
  assert.equal(fk.name, 'user_id')
  assert.deepEqual(fk.references, { table: 'users', column: 'id' })
})

test('pushSubscriptionsSchemas({ pushOwner }) owns by organization_id on organizations', () => {
  const fk = ownerFkOf({ pushOwner: { table: 'organizations', column: 'organization_id' } })
  assert.equal(fk.name, 'organization_id')
  assert.deepEqual(fk.references, { table: 'organizations', column: 'id' })
})

test('a column-only owner binding keeps the subject table, owns by the given column', () => {
  const fk = ownerFkOf({ pushOwner: { column: 'account_id' } })
  assert.equal(fk.name, 'account_id')
  assert.deepEqual(fk.references, { table: 'users', column: 'id' })
})
