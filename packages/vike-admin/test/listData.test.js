// listData — the /admin/:table list hook — exercised without Vike/React over the memory
// adapter. Pins the paging + sorting behaviour (#86): a page slice through universal-orm
// find(limit/offset/orderBy), a total via count, page clamping, and the sortable-only
// guard on the `?sort=` param.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineResource, column } from '../define.js'
import { resolveAdminTables, buildDb } from '../resolve.js'
import { listData } from '../data.js'

const usersSchema = defineSchema('users', (t) => {
  t.uuid('id').primary()
  t.string('email').unique()
  t.string('name').nullable()
  t.boolean('active').default(true)
  t.timestamps()
})

// email is sortable; name is a plain (non-sortable) column.
const resource = defineResource({ table: 'users', list: [column('email').sortable(), column('name')] })
const config = { schemas: [usersSchema], adminResources: [resource] }

const pc = (search = {}) => ({ routeParams: { table: 'users' }, config, user: { role: 'admin' }, urlParsed: { search } })

// Seed N users with zero-padded, lexicographically sortable emails (00..N-1).
async function seed(n) {
  const db = buildDb(resolveAdminTables(config))
  for (let i = 0; i < n; i++) {
    await db.users.insert({ id: `u${i}`, email: `user-${String(i).padStart(2, '0')}@b.com`, name: `User ${i}`, active: true })
  }
}

beforeEach(() => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
})

test('first page returns one page-size slice with the right totals', async () => {
  await seed(25)
  const data = await listData(pc())
  assert.equal(data.total, 25)
  assert.equal(data.pageSize, 20)
  assert.equal(data.pageCount, 2)
  assert.equal(data.page, 1)
  assert.equal(data.rows.length, 20)
})

test('the second page returns the remainder', async () => {
  await seed(25)
  const data = await listData(pc({ page: '2' }))
  assert.equal(data.page, 2)
  assert.equal(data.rows.length, 5)
})

test('an out-of-range page clamps to the last page', async () => {
  await seed(25)
  const data = await listData(pc({ page: '999' }))
  assert.equal(data.page, 2)
  assert.equal(data.rows.length, 5)
})

test('sorting by a sortable column, descending, paginates the sorted set', async () => {
  await seed(25)
  const data = await listData(pc({ sort: 'email', dir: 'desc' }))
  assert.equal(data.sort, 'email')
  assert.equal(data.dir, 'desc')
  assert.equal(data.rows[0].email, 'user-24@b.com') // highest email first
  assert.equal(data.rows.length, 20)
})

test('a non-sortable or unknown sort param is ignored (no error, no ordering)', async () => {
  await seed(3)
  // `name` is a real column but not marked sortable; `bogus` is not a column at all.
  for (const sort of ['name', 'bogus']) {
    const data = await listData(pc({ sort }))
    assert.equal(data.sort, null)
    assert.equal(data.rows.length, 3)
  }
})

test('empty table yields page 1 of 1 with no rows', async () => {
  const data = await listData(pc())
  assert.equal(data.total, 0)
  assert.equal(data.pageCount, 1)
  assert.equal(data.page, 1)
  assert.deepEqual(data.rows, [])
})
