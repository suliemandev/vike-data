// The RBAC core is pure policy: resolve a user's effective access from the join
// rows, then can()/hasRole() are lookups. These pin the resolution + the deny-safe
// defaults (signed-out and unresolved are never allowed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSchemas } from '@vike-data/universal-schema'
import {
  definePermissions,
  allPermissions,
  can,
  hasRole,
  requirePermission,
  resolveUserAccess,
} from '../index.js'
import { rbacSchemas } from '../schema.js'
import config from '../+config.js'

const DATA = {
  roles: [
    { id: 'r-admin', name: 'admin' },
    { id: 'r-member', name: 'member' },
  ],
  permissions: [
    { id: 'p-view', name: 'users.view' },
    { id: 'p-edit', name: 'users.edit' },
    { id: 'p-read', name: 'posts.read' },
  ],
  roleUser: [
    { user_id: 'u-ada', role_id: 'r-admin' },
    { user_id: 'u-mem', role_id: 'r-member' },
  ],
  permissionRole: [
    { role_id: 'r-admin', permission_id: 'p-view' },
    { role_id: 'r-admin', permission_id: 'p-edit' },
    { role_id: 'r-member', permission_id: 'p-read' },
  ],
}

const accessFor = (id) => resolveUserAccess(id, DATA)
const userWith = (id) => ({ id, ...accessFor(id) })

test('resolveUserAccess composes user -> roles -> permissions', () => {
  assert.deepEqual(accessFor('u-ada'), { roles: ['admin'], permissions: ['users.view', 'users.edit'] })
  assert.deepEqual(accessFor('u-mem'), { roles: ['member'], permissions: ['posts.read'] })
})

test('resolveUserAccess returns empty for an unknown / missing user', () => {
  assert.deepEqual(accessFor('nobody'), { roles: [], permissions: [] })
  assert.deepEqual(resolveUserAccess(undefined, DATA), { roles: [], permissions: [] })
})

test('can() checks a resolved permission, deny-safe for signed-out/unresolved', () => {
  const ada = userWith('u-ada')
  assert.equal(can(ada, 'users.edit'), true)
  assert.equal(can(ada, 'posts.read'), false) // admin role doesn't grant it here
  assert.equal(can(userWith('u-mem'), 'posts.read'), true)
  assert.equal(can(null, 'users.view'), false) // signed out
  assert.equal(can({ id: 'x' }, 'users.view'), false) // unresolved -> denied, never allow
  assert.equal(can(ada, ''), false)
})

test('hasRole() checks a resolved role name', () => {
  assert.equal(hasRole(userWith('u-ada'), 'admin'), true)
  assert.equal(hasRole(userWith('u-mem'), 'admin'), false)
  assert.equal(hasRole(null, 'admin'), false)
})

test('requirePermission() guard throws 403 unless the user holds it', () => {
  const guard = requirePermission('users.edit')
  assert.doesNotThrow(() => guard({ user: userWith('u-ada') }))
  assert.throws(() => guard({ user: userWith('u-mem') }), (e) => e.statusCode === 403)
  assert.throws(() => guard({ user: null }), (e) => e.statusCode === 403)
})

test('definePermissions/allPermissions pass data through + flatten the registry', () => {
  const a = definePermissions([{ name: 'users.view', roles: ['admin'] }])
  assert.deepEqual(a, [{ name: 'users.view', roles: ['admin'] }])
  // cumulative registry arrives as array-of-per-source-arrays
  assert.deepEqual(
    allPermissions([[{ name: 'a' }], [{ name: 'b' }, null]]).map((p) => p.name),
    ['a', 'b'],
  )
})

test('+config declares the permissions registry (cumulative) + contributes the schema', () => {
  assert.equal(config.meta.permissions.cumulative, true)
  assert.ok(config.extends.includes('import:vike-auth/config:default'))
  assert.equal(config.schemas, rbacSchemas)
})

test('the RBAC schema merges into four tables with the join FKs', () => {
  const { tables } = mergeSchemas(rbacSchemas)
  const names = tables.map((t) => t.table).sort()
  assert.deepEqual(names, ['permission_role', 'permissions', 'role_user', 'roles'])
  const roleUser = tables.find((t) => t.table === 'role_user')
  assert.ok(roleUser.columns.some((c) => c.name === 'user_id'))
  assert.ok(roleUser.columns.some((c) => c.name === 'role_id'))
})
