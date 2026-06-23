// The agent-API guardrail at the data-hook level (#113): a `?query=` filter is AND-merged
// UNDER the row scope (#104), so a caller can narrow their own rows but can never widen
// past the scope. Exercised on listData directly over the memory adapter (no Vike/React) —
// the same hook the JSON endpoint renders, so this pins the security property at its source.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineResource, column } from '../define.js'
import { resolveAdminTables, buildDb } from '../resolve.js'
import { listData } from '../data.js'

const sessionsSchema = defineSchema('sessions', (t) => {
  t.uuid('id').primary()
  t.uuid('user_id')
  t.string('token').unique()
  t.timestamps()
})

// Scoped like the demo: an admin sees every row; anyone else is bound to their own user_id.
const resource = defineResource({
  table: 'sessions',
  list: [column('user_id').sortable(), column('token')],
  scope: (user) => (user.role === 'admin' ? null : { user_id: user.id }),
})
const config = { schemas: [sessionsSchema], adminResources: [resource] }

const pc = (user, search = {}) => ({ routeParams: { table: 'sessions' }, config, user, urlParsed: { search } })
const alan = { id: 'u-alan', role: 'member' }
const admin = { id: 'u-ada', role: 'admin' }
const query = (obj) => ({ query: JSON.stringify(obj) })

beforeEach(async () => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
  const db = buildDb(resolveAdminTables(config))
  await db.sessions.insert({ id: 's-alan', user_id: 'u-alan', token: 'tok-alan' })
  await db.sessions.insert({ id: 's-ada1', user_id: 'u-ada', token: 'tok-ada-1' })
  await db.sessions.insert({ id: 's-ada2', user_id: 'u-ada', token: 'tok-ada-2' })
})

test('a scoped user sees only their own rows', async () => {
  const data = await listData(pc(alan))
  assert.equal(data.total, 1)
  assert.deepEqual([...new Set(data.rows.map((r) => r.user_id))], ['u-alan'])
})

test('a widening filter is clamped: scope wins over the caller-supplied column', async () => {
  // alan asks for ada's rows; the scope (user_id: u-alan) is AND-merged last, so he still
  // only gets his own — the query can never escape the boundary the UI enforces.
  const data = await listData(pc(alan, query({ filter: { user_id: 'u-ada' } })))
  assert.equal(data.total, 1)
  assert.deepEqual([...new Set(data.rows.map((r) => r.user_id))], ['u-alan'])
})

test('a narrowing filter within scope is applied', async () => {
  // admin (unscoped) narrows to one user via the query.
  const data = await listData(pc(admin, query({ filter: { user_id: 'u-ada' } })))
  assert.equal(data.total, 2)
  assert.deepEqual([...new Set(data.rows.map((r) => r.user_id))], ['u-ada'])
})

test('admin (unscoped) sees every row', async () => {
  const data = await listData(pc(admin))
  assert.equal(data.total, 3)
})

test('limit/offset from the query window the result', async () => {
  const data = await listData(pc(admin, query({ orderBy: 'user_id', limit: 2, offset: 1 })))
  assert.equal(data.total, 3) // total ignores the window
  assert.equal(data.rows.length, 2)
  assert.equal(data.pageSize, 2)
})

test('an invalid query records adminApiError (the API turns it into a 400) and renders scope-only', async () => {
  for (const bad of [{ filter: { nope: 1 } }, { orderBy: 'token' /* not sortable */ }]) {
    const ctx = pc(admin, query(bad))
    const data = await listData(ctx)
    assert.ok(ctx.adminApiError, 'the bad query is recorded on pageContext')
    // falls back to an empty query (no filter), so the HTML list still renders every row.
    assert.equal(data.total, 3)
  }
})
