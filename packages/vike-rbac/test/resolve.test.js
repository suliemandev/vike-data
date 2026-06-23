// The request-time resolver enriches pageContext.user with roles + permissions, and
// (this is the #111 addition) grants a roleless user the app's configured
// `defaultRoles` on their first authenticated request — the default-role-on-signup
// seam. These drive it through the real adapter the way oncreate.js does.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { resolveAccessOnto } from '../resolve.js'
import { seedRbac, assignRoles } from '../seed.js'
import { definePermissions } from '../index.js'

const DB_KEY = Symbol.for('vike-rbac.db')
const REGISTRY = definePermissions([
  { name: 'users.view', label: 'View users', roles: ['admin'] },
  { name: 'users.edit', label: 'Edit users', roles: ['admin'] },
])

// resolve.js caches its repository on globalThis; reset it + the registered adapter so
// each test resolves against its own freshly-seeded backend.
async function freshAdapter() {
  globalThis[DB_KEY] = undefined
  clearAdapter()
  const a = createMemoryAdapter()
  setAdapter(a)
  await seedRbac(a, REGISTRY, { roles: ['member'] })
  return a
}

test('resolveAccessOnto attaches the resolved roles + permissions onto the user', async () => {
  const a = await freshAdapter()
  await assignRoles(a, 'u-ada', ['admin'])
  const pageContext = { user: { id: 'u-ada' }, config: {} }
  await resolveAccessOnto(pageContext)
  assert.deepEqual(pageContext.user.roles, ['admin'])
  assert.deepEqual(pageContext.user.permissions.sort(), ['users.edit', 'users.view'])
})

test('a roleless user is granted the configured defaultRoles on resolve', async () => {
  const a = await freshAdapter()
  const pageContext = { user: { id: 'u-new' }, config: { defaultRoles: [['member']] } }
  await resolveAccessOnto(pageContext)
  assert.deepEqual(pageContext.user.roles, ['member'])
  // and it persisted: a second resolve reads the same single role_user row
  await resolveAccessOnto({ user: { id: 'u-new' }, config: { defaultRoles: [['member']] } })
  assert.equal((await a.find('role_user', { user_id: 'u-new' })).length, 1)
})

test('no defaultRoles configured -> a roleless user stays roleless', async () => {
  await freshAdapter()
  const pageContext = { user: { id: 'u-none' }, config: {} }
  await resolveAccessOnto(pageContext)
  assert.deepEqual(pageContext.user.roles, [])
  assert.deepEqual(pageContext.user.permissions, [])
})

test('resolveAccessOnto bails on client-side / signed-out', async () => {
  await freshAdapter()
  const clientCtx = { isClientSide: true, user: { id: 'u-ada' } }
  await resolveAccessOnto(clientCtx)
  assert.equal(clientCtx.user.roles, undefined) // untouched
  const anon = { user: null, config: { defaultRoles: [['member']] } }
  await resolveAccessOnto(anon) // no throw, nothing to resolve
  assert.equal(anon.user, null)
})
