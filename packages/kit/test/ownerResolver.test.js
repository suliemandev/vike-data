import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOwner, DEFAULT_OWNER_COLUMN } from '../index.js'

// resolveOwner is the OWNER-axis contract (#250): { ownerTable, ownerColumn } from an
// extension's default owner table + the app's opt-in binding. Pure (no env/globals) so it
// composes with whatever subject/guard resolution the extension already does.

test('the default owner column is user_id', () => {
  assert.equal(DEFAULT_OWNER_COLUMN, 'user_id')
})

test('no binding: owns by the default table on user_id (byte-for-byte single-owner)', () => {
  assert.deepEqual(resolveOwner('users'), { ownerTable: 'users', ownerColumn: 'user_id' })
  assert.deepEqual(resolveOwner('users', {}), { ownerTable: 'users', ownerColumn: 'user_id' })
})

test('the default table follows the extension (a renamed/guard subject)', () => {
  // The extension passes its already-resolved subject table; resolveOwner just defaults to it.
  assert.deepEqual(resolveOwner('admins'), { ownerTable: 'admins', ownerColumn: 'user_id' })
})

test('opt-in org binding swaps BOTH the column and the table', () => {
  assert.deepEqual(
    resolveOwner('users', { table: 'organizations', column: 'organization_id' }),
    { ownerTable: 'organizations', ownerColumn: 'organization_id' },
  )
})

test('a partial binding overrides only what it sets', () => {
  // column only: keep the default table, own by a different column.
  assert.deepEqual(resolveOwner('users', { column: 'organization_id' }), {
    ownerTable: 'users',
    ownerColumn: 'organization_id',
  })
  // table only: own the default user_id column, but in another table.
  assert.deepEqual(resolveOwner('users', { table: 'organizations' }), {
    ownerTable: 'organizations',
    ownerColumn: 'user_id',
  })
})

test('blank / whitespace table or column falls through to the default', () => {
  assert.deepEqual(resolveOwner('users', { table: '   ', column: '' }), {
    ownerTable: 'users',
    ownerColumn: 'user_id',
  })
})

test('values are trimmed (a stray space never produces a nameless table/column)', () => {
  assert.deepEqual(resolveOwner('users', { table: ' organizations ', column: ' organization_id ' }), {
    ownerTable: 'organizations',
    ownerColumn: 'organization_id',
  })
})
