// Named guards (#267): defineGuard declares an independent auth audience over its own
// tables, with its own cookie + endpoint namespace, keyed by name on a globalThis registry.
// These cover the declaration surface + the per-guard ISOLATION that the whole feature
// rests on (two guards never share a store or a session).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineGuard, getGuard, getGuards } from '../guards.js'
import { SESSION_COOKIE } from '../constants.js'

const ADMIN = { subject: 'Admin', users: 'admins', sessions: 'admin_sessions', loginTokens: 'admin_login_tokens' }
const CLIENT = { subject: 'Client', users: 'clients', sessions: 'client_sessions', loginTokens: 'client_login_tokens' }

// ---------------------------------------------------------- derivation --------

test('a guard derives its own cookie name and endpoint base from its name', () => {
  const admin = defineGuard('admin', ADMIN)
  assert.equal(admin.cookieName, `${SESSION_COOKIE}__admin`) // vike_auth_session__admin
  assert.equal(admin.basePath, '/admin-auth')
  assert.equal(admin.name, 'admin')
})

test('the guard resolves its own subject tables (explicit config, no env read)', () => {
  const admin = getGuard('admin')
  assert.deepEqual(
    { users: admin.subject.users, sessions: admin.subject.sessions, loginTokens: admin.subject.loginTokens },
    { users: 'admins', sessions: 'admin_sessions', loginTokens: 'admin_login_tokens' },
  )
  // column defaults are preserved (email/name/id), like the default subject
  assert.equal(admin.subject.emailColumn, 'email')
})

test('a guard contributes its three tables under its own names, FK re-pointed', () => {
  const admin = getGuard('admin')
  assert.deepEqual(admin.schemas.map((f) => f.table), ['admins', 'admin_sessions', 'admin_login_tokens'])
  const fk = admin.schemas.find((f) => f.table === 'admin_sessions').columns.find((c) => c.name === 'user_id')
  assert.deepEqual(fk.references, { table: 'admins', column: 'id' })
})

// ----------------------------------------------------------- validation -------

test('an invalid guard name is rejected loudly', () => {
  for (const bad of ['', 'Admin', '1admin', 'admin_x', 'admin auth', '/admin', 42, null]) {
    assert.throws(() => defineGuard(bad, ADMIN), /invalid guard name/)
  }
})

test('defineGuard is idempotent per name (HMR / double import returns the same descriptor)', () => {
  const a = defineGuard('admin', ADMIN)
  const b = defineGuard('admin', ADMIN)
  assert.equal(a, b) // same descriptor instance, not a second one over the same tables
})

// ----------------------------------------------------------- registry ---------

test('getGuards lists every declared guard; getGuard reads one by name', () => {
  defineGuard('client', CLIENT)
  const names = getGuards().map((g) => g.name).sort()
  assert.deepEqual(names, ['admin', 'client'])
  assert.equal(getGuard('client').basePath, '/client-auth')
  assert.equal(getGuard('nope'), null)
})

// ----------------------------------------------------------- isolation --------

test('two guards have fully independent stores: a session in one is unknown to the other', async () => {
  const admin = getGuard('admin')
  const client = getGuard('client')

  // Sign a user into the ADMIN guard (memory store, no adapter registered).
  const { token: adminLink } = await admin.instance.requestMagicLink('boss@example.com')
  const adminRedeem = await admin.instance.redeemMagicLink(adminLink)
  assert.ok(adminRedeem.ok)
  const adminSession = adminRedeem.session.token

  // The admin session resolves on the admin guard...
  const adminResolved = await admin.instance.authenticate(adminSession)
  assert.equal(adminResolved.user.email, 'boss@example.com')

  // ...but is meaningless on the client guard (different store) — no cross-talk.
  assert.equal(await client.instance.authenticate(adminSession), null)

  // And the client store never learned about the admin user.
  assert.equal(await client.instance.store.findUserByEmail('boss@example.com'), null)
})
