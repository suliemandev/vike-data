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

test('orgRoleSource reads a memberships table and resolves org-scoped access (#109)', async () => {
  const a = await freshAdapter()
  // Ada is a GLOBAL admin AND, via a memberships row, an admin in org-A only.
  await assignRoles(a, 'u-ada', ['admin'])
  await a.insert('memberships', { id: 'm-1', user_id: 'u-mem', organization_id: 'org-A', role: 'admin' })
  await a.insert('memberships', { id: 'm-2', user_id: 'u-mem', organization_id: 'org-B', role: 'member' })

  // u-mem has no global role, only org memberships.
  const ctx = { user: { id: 'u-mem' }, config: { orgRoleSource: 'memberships' } }
  await resolveAccessOnto(ctx)
  assert.deepEqual(ctx.user.roles, []) // no app-wide role
  assert.deepEqual(ctx.user.permissions, [])
  assert.deepEqual(ctx.user.orgRoles, { 'org-A': ['admin'], 'org-B': ['member'] })
  assert.deepEqual(ctx.user.orgPermissions['org-A'].sort(), ['users.edit', 'users.view'])
})

test('no orgRoleSource configured -> no org maps, no extra read (#109)', async () => {
  const a = await freshAdapter()
  await a.insert('memberships', { id: 'm-1', user_id: 'u-x', organization_id: 'org-A', role: 'admin' })
  const ctx = { user: { id: 'u-x' }, config: {} } // memberships present but not wired
  await resolveAccessOnto(ctx)
  assert.deepEqual(ctx.user.orgRoles, {})
  assert.deepEqual(ctx.user.orgPermissions, {})
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
