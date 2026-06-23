// seedRbac materializes the RBAC tables from the `permissions` registry (the inverse
// of resolveUserAccess), and assignRoles is the default-role-on-signup primitive.
// These pin the derivation, idempotency, and the end-to-end "seed -> assign -> can()".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryAdapter } from '@universal-orm/memory'
import { seedRbac, assignRoles, rolesInRegistry } from '../seed.js'
import { definePermissions, resolveUserAccess } from '../index.js'

const REGISTRY = definePermissions([
  { name: 'users.view', label: 'View users', roles: ['admin'] },
  { name: 'users.edit', label: 'Edit users', roles: ['admin'] },
  { name: 'posts.read', roles: ['admin', 'member'] },
])

// Re-read every RBAC table so a test can resolve access exactly like resolve.js does.
const dump = async (a) => ({
  roleUser: await a.find('role_user', {}),
  roles: await a.find('roles', {}),
  permissionRole: await a.find('permission_role', {}),
  permissions: await a.find('permissions', {}),
})

test('rolesInRegistry is the union of every entry’s roles', () => {
  assert.deepEqual(rolesInRegistry(REGISTRY).sort(), ['admin', 'member'])
  assert.deepEqual(rolesInRegistry([]), [])
})

test('seedRbac derives roles, permissions, and grants from the registry', async () => {
  const a = createMemoryAdapter()
  const res = await seedRbac(a, REGISTRY)

  assert.deepEqual((await a.find('roles', {})).map((r) => r.name).sort(), ['admin', 'member'])
  assert.deepEqual(
    (await a.find('permissions', {})).map((p) => p.name).sort(),
    ['posts.read', 'users.edit', 'users.view'],
  )
  // admin -> 3 grants, member -> 1 (posts.read only)
  assert.equal((await a.find('permission_role', {})).length, 4)
  // label carried through; a missing label becomes null
  assert.equal((await a.find('permissions', { name: 'users.view' }))[0].label, 'View users')
  assert.equal((await a.find('permissions', { name: 'posts.read' }))[0].label, null)
  assert.equal(res.grants.length, 4)
})

test('seedRbac is idempotent — a re-run adds nothing and keeps ids stable', async () => {
  const a = createMemoryAdapter()
  await seedRbac(a, REGISTRY)
  const before = await dump(a)
  await seedRbac(a, REGISTRY)
  const after = await dump(a)
  assert.deepEqual(after, before) // same rows, same ids, no duplicates
})

test('seedRbac materializes a standalone role that grants nothing', async () => {
  const a = createMemoryAdapter()
  await seedRbac(a, definePermissions([{ name: 'users.view', roles: ['admin'] }]), { roles: ['member'] })
  assert.deepEqual((await a.find('roles', {})).map((r) => r.name).sort(), ['admin', 'member'])
  // member exists but has no grants
  const member = (await a.find('roles', { name: 'member' }))[0]
  assert.equal((await a.find('permission_role', { role_id: member.id })).length, 0)
})

test('assignRoles grants a role to a user and resolves through to can()', async () => {
  const a = createMemoryAdapter()
  await seedRbac(a, REGISTRY)
  const created = await assignRoles(a, 'u-ada', ['admin'])
  assert.equal(created.length, 1)

  const access = resolveUserAccess('u-ada', await dump(a))
  assert.deepEqual(access.roles, ['admin'])
  assert.deepEqual(access.permissions.sort(), ['posts.read', 'users.edit', 'users.view'])
})

test('assignRoles is idempotent and a no-op for an unknown role', async () => {
  const a = createMemoryAdapter()
  await seedRbac(a, REGISTRY)
  await assignRoles(a, 'u-mem', ['member'])
  const second = await assignRoles(a, 'u-mem', ['member']) // already has it
  assert.equal(second.length, 0)
  const unknown = await assignRoles(a, 'u-mem', ['ghost']) // not seeded
  assert.equal(unknown.length, 0)
  assert.equal((await a.find('role_user', { user_id: 'u-mem' })).length, 1)
})

test('seedRbac throws without an adapter', async () => {
  await assert.rejects(() => seedRbac(undefined, REGISTRY), /requires a universal-orm adapter/)
})
