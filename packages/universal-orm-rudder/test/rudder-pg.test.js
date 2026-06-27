// @universal-orm/rudder over a REAL @rudderjs/database NativeAdapter on REAL Postgres
// (the porsager `pg` driver, not sqlite). Every other adapter test runs on sqlite/pglite,
// so the pg-only round-trip behaviour — driver type coercion, timestamptz handling — was
// unexercised until here. Gated on RUDDER_PG_URL: the suite skips cleanly when it is unset
// (so CI without a Postgres service stays green), and runs end to end when it is set.
//
//   RUDDER_PG_URL=postgres://user@localhost:5432/db pnpm --filter @universal-orm/rudder test
//
// Holds the adapter to the SAME contract as the sqlite suite, PLUS the pg-specific property:
// a timestamp column written as a UTC ISO string reads back as that SAME ISO string (not a
// JS Date, and not shifted by the server's local offset).
import { test, describe, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { NativeAdapter } from '@rudderjs/database/native'
import { createRudderAdapter } from '../src/index.js'

const PG_URL = process.env.RUDDER_PG_URL

const DDL = [
  `CREATE TABLE items (
     id SERIAL PRIMARY KEY,
     slug TEXT UNIQUE,
     display_name TEXT,
     qty INTEGER,
     created_at TIMESTAMPTZ
   )`,
  // PK that is NOT `id`, and a composite PK — the #142 shapes, on real pg.
  `CREATE TABLE tokens (token TEXT PRIMARY KEY, used BOOLEAN)`,
  `CREATE TABLE grants (user_id TEXT, role TEXT, level INTEGER, PRIMARY KEY (user_id, role))`,
  // a column the DB defaults, to exercise insert/upsert against server-generated values.
  `CREATE TABLE defk (code TEXT PRIMARY KEY DEFAULT 'GEN', payload TEXT)`,
]

describe('@universal-orm/rudder on real Postgres', { skip: PG_URL ? false : 'set RUDDER_PG_URL to run' }, () => {
  let native
  let db

  before(async () => {
    native = await NativeAdapter.make({ driver: 'pg', url: PG_URL })
    for (const t of ['items', 'tokens', 'grants', 'defk']) await native.affectingStatement(`DROP TABLE IF EXISTS ${t}`, [])
    for (const ddl of DDL) await native.affectingStatement(ddl, [])
    db = createRudderAdapter(native)
  })

  after(async () => {
    for (const t of ['items', 'tokens', 'grants', 'defk']) await native.affectingStatement(`DROP TABLE IF EXISTS ${t}`, [])
    await native.disconnect()
  })

  beforeEach(async () => {
    for (const t of ['items', 'tokens', 'grants', 'defk']) await native.affectingStatement(`DELETE FROM ${t}`, [])
  })

  const seed = (rows) => Promise.all(rows.map((r) => db.insert('items', r)))

  // ---- the contract, same as the sqlite suite, now proven on pg ----------------

  test('insert returns the stored row, including the DB-generated primary key', async () => {
    const row = await db.insert('items', { slug: 'a', display_name: 'Apple', qty: 3 })
    assert.ok(row.id, 'the DB generated a serial primary key')
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
    assert.deepEqual((await db.find('items', { slug: { in: ['a', 'c'] } })).map((r) => r.slug).sort(), ['a', 'c'])
  })

  test('`in: []` matches no rows', async () => {
    await seed([{ slug: 'a', display_name: 'A', qty: 1 }])
    assert.equal((await db.find('items', { slug: { in: [] } })).length, 0)
  })

  test('find honours orderBy + limit + offset', async () => {
    await seed([
      { slug: 'a', display_name: 'Apple', qty: 3 },
      { slug: 'b', display_name: 'Banana', qty: 1 },
      { slug: 'c', display_name: 'Cherry', qty: 2 },
    ])
    const rows = await db.find('items', {}, { orderBy: { column: 'qty', dir: 'desc' }, limit: 2, offset: 1 })
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

  test('`{ col: null }` filter is IS NULL, not = NULL', async () => {
    await seed([
      { slug: 'a', display_name: 'A', qty: 1 },
      { slug: 'b', display_name: null, qty: 1 },
    ])
    assert.deepEqual((await db.find('items', { display_name: null })).map((r) => r.slug), ['b'])
    assert.equal(await db.count('items', { display_name: null }), 1)
  })

  test('update returns the changed rows, even when the patch mutates the filtered column', async () => {
    await seed([
      { slug: 'a', display_name: 'A', qty: 1 },
      { slug: 'b', display_name: 'B', qty: 1 },
      { slug: 'c', display_name: 'C', qty: 5 },
    ])
    const updated = await db.update('items', { qty: 1 }, { qty: 2 })
    assert.equal(updated.length, 2)
    assert.deepEqual(updated.map((r) => r.qty), [2, 2])
    assert.equal(await db.count('items', { qty: 2 }), 2)
  })

  test('update on a non-matching filter is a no-op returning []', async () => {
    await seed([{ slug: 'a', display_name: 'A', qty: 1 }])
    assert.deepEqual(await db.update('items', { slug: 'nope' }, { qty: 9 }), [])
  })

  test('update with an empty patch is a no-op returning the matched rows (not a throw)', async () => {
    await seed([
      { slug: 'a', display_name: 'A', qty: 1 },
      { slug: 'b', display_name: 'B', qty: 1 },
    ])
    const rows = await db.update('items', { qty: 1 }, {})
    assert.equal(rows.length, 2)
    assert.equal(await db.count('items', { qty: 1 }), 2)
  })

  test('update returns the changed row on a non-`id` PK (#142)', async () => {
    await db.insert('tokens', { token: 'tok_a', used: false })
    const updated = await db.update('tokens', { token: 'tok_a' }, { used: true })
    assert.equal(updated.length, 1)
    assert.equal(updated[0].used, true)
    assert.equal((await db.find('tokens', { token: 'tok_a' }))[0].used, true)
  })

  test('update returns the changed row on a COMPOSITE PK (#142)', async () => {
    await db.insert('grants', { user_id: 'u1', role: 'admin', level: 1 })
    await db.insert('grants', { user_id: 'u1', role: 'member', level: 1 })
    const updated = await db.update('grants', { user_id: 'u1', role: 'admin' }, { level: 5 })
    assert.deepEqual(updated, [{ user_id: 'u1', role: 'admin', level: 5 }])
    assert.equal((await db.find('grants', { user_id: 'u1', role: 'member' }))[0].level, 1)
  })

  test('upsert: inserts, then converges the same row keyed by the conflict column', async () => {
    const first = await db.upsert('items', { slug: 'k', display_name: 'First', qty: 1 }, { onConflict: ['slug'] })
    assert.equal(first.display_name, 'First')
    const second = await db.upsert('items', { slug: 'k', display_name: 'Second', qty: 9 }, { onConflict: ['slug'] })
    assert.equal(second.display_name, 'Second')
    assert.equal(second.qty, 9)
    assert.equal(await db.count('items', {}), 1)
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

  // ---- the pg-specific property: timestamp round-trip (the reason this suite exists) ----

  // The porsager pg driver parses a TIMESTAMPTZ column to a JS Date on read; universal-orm
  // and the memory/sqlite adapters speak UTC ISO strings. The adapter normalises Dates back
  // to ISO strings so the same neutral call returns a string on every driver. This is the
  // regression test for that normalisation (#321) and proves the instant is not shifted.
  const INSTANT = '2020-01-01T00:00:00.000Z'

  test('a timestamp column reads back as the SAME UTC ISO string it was written (not a Date)', async () => {
    const inserted = await db.insert('items', { slug: 't', display_name: 'T', qty: 0, created_at: INSTANT })
    assert.equal(typeof inserted.created_at, 'string', 'insert returns a string, not a Date')
    assert.equal(inserted.created_at, INSTANT)

    const [found] = await db.find('items', { slug: 't' })
    assert.equal(typeof found.created_at, 'string', 'find returns a string, not a Date')
    assert.equal(found.created_at, INSTANT, 'same instant, not shifted by the server offset')

    // equality-filtering by the ISO string works (it would not if the read value were a Date).
    assert.equal((await db.find('items', { created_at: INSTANT })).length, 1)
  })

  test('update returning a row carries the timestamp as an ISO string', async () => {
    await db.insert('items', { slug: 'u', display_name: 'U', qty: 1, created_at: INSTANT })
    const [updated] = await db.update('items', { slug: 'u' }, { qty: 2 })
    assert.equal(typeof updated.created_at, 'string')
    assert.equal(updated.created_at, INSTANT)
  })
})
