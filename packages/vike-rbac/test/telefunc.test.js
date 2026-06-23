// The Telefunc seam (#110): the SAME can()/hasRole() that guards a page and backs
// vike-admin's canView now guards an RPC. Three things are covered:
//   - resolveAccess(userId): the RPC path resolves the same GLOBAL roles/permissions
//     by user id that the page enricher attaches (so the context user matches).
//   - the guard cores (checkUser/checkPermission/checkRole): explicit user in, Abort
//     out on denial — the real Telefunc Abort (err.isAbort, a 403 to the client).
//   - the telefunction guards (currentUser/requirePermission/requireRole): they read
//     the user from Telefunc's context, which provideTelefuncContext sets in a test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { provideTelefuncContext } from 'telefunc'
import { resolveAccess } from '../resolve.js'
import { seedRbac, assignRoles } from '../seed.js'
import { definePermissions } from '../index.js'
import {
  checkUser,
  checkPermission,
  checkRole,
  currentUser,
  requirePermission,
  requireRole,
  can,
  hasRole,
} from '../telefunc.js'
import telefuncMiddleware from '../telefunc-middleware.js'

const DB_KEY = Symbol.for('vike-rbac.db')
const REGISTRY = definePermissions([
  { name: 'users.view', label: 'View users', roles: ['admin'] },
  { name: 'users.edit', label: 'Edit users', roles: ['admin'] },
])

// resolve.js caches its repository on globalThis; reset it + the registered adapter
// so each test resolves against its own freshly-seeded backend (mirrors resolve.test).
async function freshAdapter() {
  globalThis[DB_KEY] = undefined
  clearAdapter()
  const a = createMemoryAdapter()
  setAdapter(a)
  await seedRbac(a, REGISTRY, { roles: ['member'] })
  return a
}

// Capture the Abort a guard throws (or null if it returned).
const aborted = (fn) => {
  try {
    fn()
    return null
  } catch (e) {
    return e
  }
}

// Resolved-user fixtures, the shape both the page enricher and resolveAccess produce.
const ada = { id: 'u-ada', email: 'ada@example.com', roles: ['admin'], permissions: ['users.view', 'users.edit'] }
const alan = { id: 'u-alan', email: 'alan@example.com', roles: ['member'], permissions: [] }

// --- resolveAccess: the RPC path reads the same GLOBAL access by user id ------

test('resolveAccess resolves global roles + permissions for an admin', async () => {
  const a = await freshAdapter()
  await assignRoles(a, 'u-ada', ['admin'])
  const access = await resolveAccess('u-ada')
  assert.deepEqual(access.roles, ['admin'])
  assert.deepEqual(access.permissions.sort(), ['users.edit', 'users.view'])
})

test('resolveAccess gives a member no permissions', async () => {
  const a = await freshAdapter()
  await assignRoles(a, 'u-alan', ['member'])
  const access = await resolveAccess('u-alan')
  assert.deepEqual(access.roles, ['member'])
  assert.deepEqual(access.permissions, [])
})

test('resolveAccess is deny-safe for an unknown / missing user id', async () => {
  await freshAdapter()
  const empty = { roles: [], permissions: [], orgRoles: {}, orgPermissions: {} }
  assert.deepEqual(await resolveAccess('nobody'), empty)
  assert.deepEqual(await resolveAccess(undefined), empty)
})

// --- guard cores: explicit user, real Abort on denial -------------------------

test('checkPermission returns the user when allowed, aborts when not', () => {
  assert.equal(checkPermission(ada, 'users.edit'), ada)
  const e = aborted(() => checkPermission(alan, 'users.edit'))
  assert.ok(e?.isAbort, 'denial throws a Telefunc Abort')
  assert.equal(e.abortValue, 'Forbidden')
})

test('checkRole gates on role name', () => {
  assert.equal(checkRole(ada, 'admin'), ada)
  assert.ok(aborted(() => checkRole(alan, 'admin'))?.isAbort)
})

test('checkUser aborts a signed-out caller (Unauthorized)', () => {
  assert.equal(checkUser(ada), ada)
  const e = aborted(() => checkUser(null))
  assert.ok(e?.isAbort)
  assert.equal(e.abortValue, 'Unauthorized')
})

// --- telefunction guards read the user from Telefunc's context ----------------

test('requirePermission reads getContext().user — allow then deny', () => {
  provideTelefuncContext({ user: ada })
  assert.equal(requirePermission('users.edit'), ada)
  provideTelefuncContext({ user: alan })
  assert.ok(aborted(() => requirePermission('users.edit'))?.isAbort)
})

test('requireRole reads the context and gates on role', () => {
  provideTelefuncContext({ user: ada })
  assert.equal(requireRole('admin'), ada)
  provideTelefuncContext({ user: alan })
  assert.ok(aborted(() => requireRole('admin'))?.isAbort)
})

test('currentUser returns the signed-in user, aborts when signed out', () => {
  provideTelefuncContext({ user: ada })
  assert.equal(currentUser(), ada)
  provideTelefuncContext({ user: null })
  assert.ok(aborted(() => currentUser())?.isAbort)
})

test('re-exported can/hasRole are the same pure predicates (branch, not abort)', () => {
  assert.equal(can(ada, 'users.view'), true)
  assert.equal(can(alan, 'users.view'), false)
  assert.equal(hasRole(ada, 'admin'), true)
  assert.equal(hasRole(alan, 'admin'), false)
})

// --- the context-provider middleware ------------------------------------------

test('the telefunc middleware falls through on a non-RPC request', async () => {
  // Only /_telefunc is handled; everything else returns nothing so Vike renders it.
  const res = await telefuncMiddleware(new Request('http://localhost/admin/users'))
  assert.equal(res, undefined)
})
