// The default subject as the "default guard" (#276): the primary, env-configured subject
// expressed through the same descriptor shape as a named guard, in the unified registry.
// These cover its special (bare) surface, that it IS the instance.js default instance, the
// reserved name, and the getAllGuards() enumeration seam.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDefaultGuard, getAllGuards, getGuard, defineGuard, DEFAULT_GUARD_NAME } from '../guards.js'
import { auth } from '../instance.js'
import { SESSION_COOKIE } from '../constants.js'

// ----------------------------------------------------- the default guard ------

test('the default guard carries the bare cookie + /auth base + default: true', () => {
  const def = getDefaultGuard()
  assert.equal(def.name, 'default')
  assert.equal(def.cookieName, SESSION_COOKIE) // vike_auth_session, NO __suffix
  assert.equal(def.basePath, '/auth') // not /default-auth
  assert.equal(def.default, true)
})

test('its subject + schemas are the default ones (users / sessions / login_tokens)', () => {
  const def = getDefaultGuard()
  assert.equal(def.subject.users, 'users')
  assert.deepEqual(def.schemas.map((f) => f.table), ['users', 'sessions', 'login_tokens'])
})

test('the default guard IS the shared instance.js auth instance (one default store)', () => {
  assert.equal(getDefaultGuard().instance, auth)
  // idempotent: same descriptor every call (globalThis-cached, no fork)
  assert.equal(getDefaultGuard(), getDefaultGuard())
})

test("getGuard('default') resolves the default guard", () => {
  assert.equal(getGuard(DEFAULT_GUARD_NAME), getDefaultGuard())
})

// --------------------------------------------------------- reserved name ------

test("'default' is reserved: defineGuard('default', ...) throws", () => {
  assert.throws(() => defineGuard('default', { table: 'whatever' }), /reserved/)
})

// ------------------------------------------------------- enumeration seam -----

test('getAllGuards() = the default guard followed by the named ones', () => {
  const before = getAllGuards()
  assert.equal(before[0].default, true) // default leads
  assert.equal(before[0].name, 'default')

  defineGuard('admin', { table: 'admins' })
  const all = getAllGuards()
  assert.equal(all[0].name, 'default')
  assert.ok(all.some((g) => g.name === 'admin' && g.default === false))
  // every entry is the same uniform descriptor shape
  for (const g of all) {
    assert.deepEqual(Object.keys(g).sort(), ['basePath', 'cookieName', 'default', 'instance', 'name', 'schemas', 'subject'])
  }
})
