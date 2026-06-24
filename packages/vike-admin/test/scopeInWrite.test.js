// Row scoping with an `in`-style scope (multi-tenant: "the orgs this user belongs to").
// A scalar scope is FORCED onto writes; an `in` scope can't force a single value, so the
// guard instead REJECTS a submitted owner value outside the allowed set — otherwise a
// scoped user could create a row owned by, or reassign a row to, a tenant they don't
// belong to. Exercised through the agent-API write path (which surfaces the error).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineResource, field } from '../define.js'
import { resolveAdminTables, buildDb } from '../resolve.js'
import { newData, editData } from '../data.js'

const docsSchema = defineSchema('docs', (t) => {
  t.uuid('id').primary()
  t.uuid('org_id')
  t.string('title')
})

// A member may write within the orgs they belong to (o1, o2); o3 is off-limits.
const resource = defineResource({
  table: 'docs',
  form: [field('org_id'), field('title')],
  scope: (user) => (user.role === 'admin' ? null : { org_id: { in: user.orgIds } }),
})
const config = { schemas: [docsSchema], adminResources: [resource] }
const member = { id: 'u1', role: 'member', orgIds: ['o1', 'o2'] }

const createCtx = (input) => ({ routeParams: { table: 'docs' }, config, user: member, adminApiWrite: { action: 'create', input } })
const updateCtx = (id, input) => ({ routeParams: { table: 'docs', id }, config, user: member, adminApiWrite: { action: 'update', input } })
const db = () => buildDb(resolveAdminTables(config))

beforeEach(() => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
})

test('create: an owner value INSIDE the in-scope set is allowed', async () => {
  const out = await newData(createCtx({ org_id: 'o1', title: 'ok' }))
  assert.equal(out.apiWrite.created.org_id, 'o1')
})

test('create: a forged owner value OUTSIDE the set is rejected (no row written)', async () => {
  const ctx = createCtx({ org_id: 'o3', title: 'forged' })
  const out = await newData(ctx)
  assert.deepEqual(out, {}) // denied -> empty view-model
  assert.match(ctx.adminApiError, /scope: "org_id" must be one of the values/)
  assert.equal((await db().docs.find({})).length, 0) // nothing inserted
})

test('update: reassigning a row to an org outside the set is rejected', async () => {
  await db().docs.insert({ id: 'd1', org_id: 'o1', title: 'mine' })
  const ctx = updateCtx('d1', { org_id: 'o3', title: 'mine' })
  const out = await editData(ctx)
  assert.deepEqual(out, {})
  assert.match(ctx.adminApiError, /scope: "org_id" must be one of the values/)
  assert.equal((await db().docs.findOne({ id: 'd1' })).org_id, 'o1') // unchanged
})
