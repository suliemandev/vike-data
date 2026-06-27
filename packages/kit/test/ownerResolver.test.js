import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOwner, resolveOwnerColumn, resolveOwnerId, DEFAULT_OWNER_COLUMN } from '../index.js'

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

// resolveOwnerColumn is the RUNTIME column reader (the request-time half of the contract): the raw
// VIKE_<X>_OWNER_COLUMN env value, trimmed, defaulting to user_id when blank/undefined.

test('resolveOwnerColumn: undefined / blank / whitespace -> the default column', () => {
  assert.equal(resolveOwnerColumn(undefined), 'user_id')
  assert.equal(resolveOwnerColumn(''), 'user_id')
  assert.equal(resolveOwnerColumn('   '), 'user_id')
})

test('resolveOwnerColumn: a set value is trimmed and returned', () => {
  assert.equal(resolveOwnerColumn('organization_id'), 'organization_id')
  assert.equal(resolveOwnerColumn(' organization_id '), 'organization_id')
})

test('resolveOwnerColumn: an explicit default column is honoured', () => {
  assert.equal(resolveOwnerColumn(undefined, 'team_id'), 'team_id')
})

// resolveOwnerId is the RUNTIME owner-id resolver. By default the owner IS the user (owner id =
// user.id); a `from` field loads the subject row and reads it, returning null when there's no owner.

test('resolveOwnerId: no `from` (or "id") -> the user is the owner, no adapter hit', async () => {
  const adapter = { find: () => assert.fail('adapter must not be touched on the default path') }
  assert.equal(await resolveOwnerId({ id: 'u1' }, { from: undefined, subjectTable: 'users', adapter }), 'u1')
  assert.equal(await resolveOwnerId({ id: 'u1' }, { from: '', subjectTable: 'users', adapter }), 'u1')
  assert.equal(await resolveOwnerId({ id: 'u1' }, { from: ' id ', subjectTable: 'users', adapter }), 'u1')
})

test('resolveOwnerId: a `from` field loads the subject row and reads the owner id', async () => {
  const calls = []
  const adapter = { find: async (table, where) => { calls.push([table, where]); return [{ id: 'u1', current_organization_id: 'org-1' }] } }
  const ownerId = await resolveOwnerId({ id: 'u1' }, { from: 'current_organization_id', subjectTable: 'users', adapter })
  assert.equal(ownerId, 'org-1')
  assert.deepEqual(calls, [['users', { id: 'u1' }]])
})

test('resolveOwnerId: a missing/blank owner field -> null (caller answers 403)', async () => {
  const adapter = { find: async () => [{ id: 'u1', current_organization_id: null }] }
  assert.equal(await resolveOwnerId({ id: 'u1' }, { from: 'current_organization_id', subjectTable: 'users', adapter }), null)
  const blank = { find: async () => [{ id: 'u1', current_organization_id: '' }] }
  assert.equal(await resolveOwnerId({ id: 'u1' }, { from: 'current_organization_id', subjectTable: 'users', adapter: blank }), null)
  const noRow = { find: async () => [] }
  assert.equal(await resolveOwnerId({ id: 'u1' }, { from: 'current_organization_id', subjectTable: 'users', adapter: noRow }), null)
})

test('resolveOwnerId: a `from` field but no adapter -> null', async () => {
  assert.equal(await resolveOwnerId({ id: 'u1' }, { from: 'current_organization_id', subjectTable: 'users', adapter: null }), null)
})
