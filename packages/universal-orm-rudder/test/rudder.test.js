// @universal-orm/rudder over a REAL @rudderjs/database NativeAdapter on in-memory sqlite
// (zero external service, runs in CI). Pins each of the six ops against the actual query
// builder, and proves the key property: neutral snake_case keys pass straight through with no
// name translation.
import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { NativeAdapter } from '@rudderjs/database/native'
import { createRudderAdapter } from '../src/index.js'

const CREATE = `
  CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    display_name TEXT,
    qty INTEGER
  )`

// A table whose primary key is NOT `id` (#142). The old update re-read by a hard-coded `id`,
// so on this table every matched row had `r.id === undefined` and update returned [].
const CREATE_TOKENS = `
  CREATE TABLE tokens (
    token TEXT PRIMARY KEY,
    used INTEGER
  )`

// A table with a COMPOSITE primary key — no single PK column to re-read by at all.
const CREATE_GRANTS = `
  CREATE TABLE grants (
    user_id TEXT,
    role TEXT,
    level INTEGER,
    PRIMARY KEY (user_id, role)
  )`

let native
let db // the universal-orm adapter

before(async () => {
  native = await NativeAdapter.make({ driver: 'sqlite', url: ':memory:' })
  await native.affectingStatement(CREATE, [])
  await native.affectingStatement(CREATE_TOKENS, [])
  await native.affectingStatement(CREATE_GRANTS, [])
  db = createRudderAdapter(native)
})

after(async () => {
  await native.disconnect()
})

beforeEach(async () => {
  await native.affectingStatement('DELETE FROM items', [])
  await native.affectingStatement('DELETE FROM tokens', [])
  await native.affectingStatement('DELETE FROM grants', [])
})

const seed = (rows) => Promise.all(rows.map((r) => db.insert('items', r)))

test('insert returns the stored row, including the DB-generated primary key', async () => {
  const row = await db.insert('items', { slug: 'a', display_name: 'Apple', qty: 3 })
  assert.ok(row.id, 'the DB generated an integer primary key')
  // snake_case key passes straight through — no camelCase casting.
  assert.equal(row.display_name, 'Apple')
  assert.equal(row.qty, 3)
})

test('find: all, equality filter, and `in` filter', async () => {
  await seed([
    { slug: 'a', display_name: 'Apple', qty: 1 },
    { slug: 'b', display_name: 'Banana', qty: 2 },
    { slug: 'c', display_name: 'Cherry', qty: 3 },
  ])
  assert.equal((await db.find('items', {})).length, 3)
  assert.deepEqual((await db.find('items', { slug: 'b' })).map((r) => r.display_name), ['Banana'])
  assert.deepEqual(
    (await db.find('items', { slug: { in: ['a', 'c'] } })).map((r) => r.slug).sort(),
    ['a', 'c'],
  )
})

test('find honours orderBy + limit + offset', async () => {
  await seed([
    { slug: 'a', display_name: 'Apple', qty: 3 },
    { slug: 'b', display_name: 'Banana', qty: 1 },
    { slug: 'c', display_name: 'Cherry', qty: 2 },
  ])
  const rows = await db.find('items', {}, { orderBy: { column: 'qty', dir: 'desc' }, limit: 2, offset: 1 })
  // qty desc => [3,2,1]; offset 1 + limit 2 => [2,1] => Cherry, Banana
  assert.deepEqual(rows.map((r) => r.display_name), ['Cherry', 'Banana'])
})

test('count respects the filter', async () => {
  await seed([
    { slug: 'a', display_name: 'A', qty: 1 },
    { slug: 'b', display_name: 'B', qty: 1 },
    { slug: 'c', display_name: 'C', qty: 9 },
  ])
  assert.equal(await db.count('items', {}), 3)
  assert.equal(await db.count('items', { qty: 1 }), 2)
})

test('update returns the changed rows, even when the patch mutates the filtered column', async () => {
  await seed([
    { slug: 'a', display_name: 'A', qty: 1 },
    { slug: 'b', display_name: 'B', qty: 1 },
    { slug: 'c', display_name: 'C', qty: 5 },
  ])
  // filter on qty:1, then bump qty to 2 — the rows no longer match the filter, but update must
  // still return them (it re-reads by the primary keys captured before the write).
  const updated = await db.update('items', { qty: 1 }, { qty: 2 })
  assert.equal(updated.length, 2)
  assert.deepEqual(updated.map((r) => r.qty), [2, 2])
  assert.equal(await db.count('items', { qty: 2 }), 2)
})

test('update on a non-matching filter is a no-op returning []', async () => {
  await seed([{ slug: 'a', display_name: 'A', qty: 1 }])
  assert.deepEqual(await db.update('items', { slug: 'nope' }, { qty: 9 }), [])
})

test('update returns the changed rows on a table whose PK is not `id` (#142)', async () => {
  await db.insert('tokens', { token: 'tok_a', used: 0 })
  await db.insert('tokens', { token: 'tok_b', used: 0 })
  // The write must succeed AND return the changed row — the old code returned [] here because
  // it re-read by a hard-coded `id` the table does not have.
  const updated = await db.update('tokens', { token: 'tok_a' }, { used: 1 })
  assert.equal(updated.length, 1)
  assert.deepEqual(updated[0], { token: 'tok_a', used: 1 })
  // ...and the row was actually mutated in the DB.
  assert.equal((await db.find('tokens', { token: 'tok_a' }))[0].used, 1)
  assert.equal((await db.find('tokens', { token: 'tok_b' }))[0].used, 0)
})

test('update returns the changed rows on a table with a COMPOSITE primary key (#142)', async () => {
  await db.insert('grants', { user_id: 'u1', role: 'admin', level: 1 })
  await db.insert('grants', { user_id: 'u1', role: 'member', level: 1 })
  const updated = await db.update('grants', { user_id: 'u1', role: 'admin' }, { level: 5 })
  assert.equal(updated.length, 1)
  assert.deepEqual(updated[0], { user_id: 'u1', role: 'admin', level: 5 })
  assert.equal((await db.find('grants', { user_id: 'u1', role: 'admin' }))[0].level, 5)
  assert.equal((await db.find('grants', { user_id: 'u1', role: 'member' }))[0].level, 1)
})

test('upsert: inserts, then converges the same row keyed by the conflict column', async () => {
  const first = await db.upsert('items', { slug: 'k', display_name: 'First', qty: 1 }, { onConflict: ['slug'] })
  assert.equal(first.display_name, 'First')

  const second = await db.upsert('items', { slug: 'k', display_name: 'Second', qty: 9 }, { onConflict: ['slug'] })
  assert.equal(second.display_name, 'Second')
  assert.equal(second.qty, 9)
  assert.equal(await db.count('items', {}), 1) // still ONE row
})

test('upsert with no conflict target is a plain insert', async () => {
  const row = await db.upsert('items', { slug: 'z', display_name: 'Zed', qty: 0 })
  assert.ok(row.id)
  assert.equal(row.display_name, 'Zed')
})

test('delete returns the number of rows removed', async () => {
  await seed([
    { slug: 'a', display_name: 'A', qty: 1 },
    { slug: 'b', display_name: 'B', qty: 1 },
    { slug: 'c', display_name: 'C', qty: 9 },
  ])
  assert.equal(await db.delete('items', { qty: 1 }), 2)
  assert.equal(await db.count('items', {}), 1)
})

test('createRudderAdapter rejects a non-NativeAdapter', () => {
  assert.throws(() => createRudderAdapter({}), /expects a @rudderjs\/database NativeAdapter/)
})
