// The agent-API write tier at the data-hook level (#115): create / update / delete driven
// by a JSON body (pageContext.adminApiWrite), going through the SAME newData / editData hooks
// the form uses, so the same `canEdit` gate, scope ownership-forcing and primary-key keying
// apply. Exercised over the memory adapter (no Vike/React).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { defineResource, field } from '../define.js'
import { resolveAdminTables, buildDb } from '../resolve.js'
import { newData, editData } from '../data.js'

const sessionsSchema = defineSchema('sessions', (t) => {
  t.uuid('id').primary()
  t.uuid('user_id')
  t.string('token').unique()
  t.timestamps()
})

// Scoped: an admin writes anything; anyone else is bound to their own user_id.
const resource = defineResource({
  table: 'sessions',
  form: [field('user_id'), field('token')],
  scope: (user) => (user.role === 'admin' ? null : { user_id: user.id }),
})
const config = { schemas: [sessionsSchema], adminResources: [resource] }
const alan = { id: 'u-alan', role: 'member' }
const admin = { id: 'u-ada', role: 'admin' }

const createCtx = (user, input) => ({ routeParams: { table: 'sessions' }, config, user, adminApiWrite: { action: 'create', input } })
const writeCtx = (user, id, action, input) => ({ routeParams: { table: 'sessions', id }, config, user, adminApiWrite: { action, input } })
const db = () => buildDb(resolveAdminTables(config))

beforeEach(() => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
})

test('create inserts, fills a uuid pk, and returns the created row', async () => {
  const out = await newData(createCtx(admin, { user_id: 'u-ada', token: 'tok-1' }))
  assert.ok(out.apiWrite.created.id, 'a uuid primary key was generated')
  assert.equal(out.apiWrite.created.token, 'tok-1')
  const rows = await db().sessions.find({})
  assert.equal(rows.length, 1)
})

test('create FORCES scope ownership: a forged owner column is overwritten', async () => {
  // alan asks to create a session owned by u-ada; the scope forces it back to u-alan.
  const out = await newData(createCtx(alan, { user_id: 'u-ada', token: 'forged' }))
  assert.equal(out.apiWrite.created.user_id, 'u-alan')
})

test('create ignores a field the resource does not expose', async () => {
  const out = await newData(createCtx(admin, { user_id: 'u-ada', token: 'tok', is_superuser: true }))
  assert.equal('is_superuser' in out.apiWrite.created, false)
})

test('update patches only the supplied fields and returns the row', async () => {
  await db().sessions.insert({ id: 's1', user_id: 'u-ada', token: 'old' })
  const out = await editData(writeCtx(admin, 's1', 'update', { token: 'new' }))
  assert.equal(out.apiWrite.updated.token, 'new')
  assert.equal(out.apiWrite.updated.user_id, 'u-ada') // untouched (partial patch)
})

test('a scoped user cannot update another owner’s row (id-guess -> notFound)', async () => {
  await db().sessions.insert({ id: 's-ada', user_id: 'u-ada', token: 'ada' })
  const out = await editData(writeCtx(alan, 's-ada', 'update', { token: 'hacked' }))
  assert.deepEqual(out.apiWrite, { notFound: true })
  // the row is untouched
  assert.equal((await db().sessions.findOne({ id: 's-ada' })).token, 'ada')
})

test('delete removes an owned row; a cross-owner delete is a no-op (notFound)', async () => {
  await db().sessions.insert({ id: 's-alan', user_id: 'u-alan', token: 'a' })
  await db().sessions.insert({ id: 's-ada', user_id: 'u-ada', token: 'b' })

  const ok = await editData(writeCtx(alan, 's-alan', 'delete'))
  assert.deepEqual(ok.apiWrite, { deleted: true })

  const denied = await editData(writeCtx(alan, 's-ada', 'delete'))
  assert.deepEqual(denied.apiWrite, { notFound: true })
  assert.ok(await db().sessions.findOne({ id: 's-ada' }), 'ada’s row survives')
})
