// The request-time resolver enriches pageContext.user with roles + permissions, and
// (this is the #111 addition) grants a roleless user the app's configured
// `defaultRoles` on their first authenticated request — the default-role-on-signup
// seam. These drive it through the real adapter the way oncreate.js does.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { resolveAccessOnto, resolveAccessForUser, setOrgRoleSource } from '../resolve.js'
import { seedRbac, assignRoles } from '../seed.js'
import { definePermissions } from '../index.js'

const DB_KEY = Symbol.for('vike-rbac.db')
const SOURCE_KEY = Symbol.for('vike-rbac.orgRoleSource')
const REGISTRY = definePermissions([
  { name: 'users.view', label: 'View users', roles: ['admin'] },
  { name: 'users.edit', label: 'Edit users', roles: ['admin'] },
])

// resolve.js caches its repository on globalThis; reset it + the registered adapter so
// each test resolves against its own freshly-seeded backend.
async function freshAdapter() {
  globalThis[DB_KEY] = undefined
  globalThis[SOURCE_KEY] = undefined // forget any remembered orgRoleSource
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

// --- named-guard binding (#291 / #207 P3) ------------------------------------

test('rbacGuard enriches the named guard user, leaving the default user untouched', async () => {
  const a = await freshAdapter()
  await assignRoles(a, 'admin-1', ['admin'])
  const ctx = {
    user: { id: 'default-1' }, // the default guard's user — must be left untouched
    guards: { admin: { user: { id: 'admin-1' } } },
    config: { rbacGuard: 'admin' },
  }
  await resolveAccessOnto(ctx)
  assert.deepEqual(ctx.guards.admin.user.roles, ['admin']) // the guard user got enriched in place
  assert.deepEqual(ctx.guards.admin.user.permissions.sort(), ['users.edit', 'users.view'])
  assert.equal(ctx.user.roles, undefined) // the default pageContext.user is untouched
})

test("rbacGuard: 'default' uses pageContext.user (byte-for-byte the default path)", async () => {
  const a = await freshAdapter()
  await assignRoles(a, 'default-1', ['admin'])
  const ctx = { user: { id: 'default-1' }, config: { rbacGuard: 'default' } }
  await resolveAccessOnto(ctx)
  assert.deepEqual(ctx.user.roles, ['admin'])
})

test('a selected guard with no resolved user is a no-op (the default user is NOT enriched)', async () => {
  const a = await freshAdapter()
  await assignRoles(a, 'default-1', ['admin'])
  const ctx = { user: { id: 'default-1' }, guards: { admin: { user: null } }, config: { rbacGuard: 'admin' } }
  await resolveAccessOnto(ctx)
  assert.equal(ctx.user.roles, undefined) // a guard was selected, so the default user is never touched
})

// --- the RPC path resolves org grants too (#235) -----------------------------

test('resolveAccessForUser folds in org grants once the enricher remembered the source', async () => {
  const a = await freshAdapter()
  await a.insert('memberships', { id: 'm-1', user_id: 'u-mem', organization_id: 'org-A', role: 'admin' })

  // No source remembered yet -> RPC path sees only global access (empty for u-mem).
  const before = await resolveAccessForUser('u-mem')
  assert.deepEqual(before.orgRoles, {})

  // A page render remembers orgRoleSource; now the RPC path resolves the SAME org grants.
  await resolveAccessOnto({ user: { id: 'u-mem' }, config: { orgRoleSource: 'memberships' } })
  const after = await resolveAccessForUser('u-mem')
  assert.deepEqual(after.orgRoles, { 'org-A': ['admin'] })
  assert.deepEqual(after.orgPermissions['org-A'].sort(), ['users.edit', 'users.view'])
})

test('setOrgRoleSource lets the RPC path resolve org grants with no prior page render', async () => {
  const a = await freshAdapter()
  await a.insert('memberships', { id: 'm-1', user_id: 'u-mem', organization_id: 'org-A', role: 'admin' })
  setOrgRoleSource('memberships') // e.g. wired at server start
  const access = await resolveAccessForUser('u-mem')
  assert.deepEqual(access.orgRoles, { 'org-A': ['admin'] })
})

test('resolveAccessForUser with no source is just the global access', async () => {
  const a = await freshAdapter()
  await assignRoles(a, 'u-ada', ['admin'])
  await a.insert('memberships', { id: 'm-1', user_id: 'u-ada', organization_id: 'org-A', role: 'admin' })
  const access = await resolveAccessForUser('u-ada') // source never set
  assert.deepEqual(access.roles, ['admin'])
  assert.deepEqual(access.permissions.sort(), ['users.edit', 'users.view'])
  assert.deepEqual(access.orgRoles, {}) // memberships present but not wired -> ignored
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
