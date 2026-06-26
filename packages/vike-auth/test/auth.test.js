// The framework/ORM-agnostic auth core: the magic-link + session lifecycle over
// a Store. These are the security-critical guards (single-use, expiry,
// find-or-create, real server-side logout), exercised against the memory store.
//
// Expiry is made deterministic by passing a NEGATIVE ttl, which mints an
// already-expired token/session at creation time (no fake clock needed).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAuth } from '../auth.js'
import { createMemoryStore } from '../store.js'

const mkAuth = (opts = {}) => createAuth({ store: createMemoryStore(), ...opts })

test('createAuth requires a store', () => {
  assert.throws(() => createAuth({}), /requires a \{ store \}/)
})

// ------------------------------------------------------------ active flag -----

test('authenticate() denies a deactivated user and tears down the session', async () => {
  let deleted = null
  const store = {
    async findSessionByToken() {
      return { token: 'sess', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }
    },
    async findUserById() {
      return { id: 'u1', email: 'banned@example.com', active: false }
    },
    async deleteSessionByToken(t) {
      deleted = t
    },
  }
  const auth = createAuth({ store })
  assert.equal(await auth.authenticate('sess'), null) // deactivated -> logged out
  assert.equal(deleted, 'sess') // the live session is destroyed
})

test('redeemMagicLink() refuses to open a session for a deactivated user', async () => {
  const store = {
    async findLoginToken() {
      return { token: 'lt', email: 'banned@example.com', consumed_at: null, expires_at: '2099-01-01T00:00:00.000Z' }
    },
    async consumeLoginToken() {
      return { token: 'lt', consumed_at: '2026-01-01T00:00:00.000Z' }
    },
    async deleteLoginToken() {},
    async findUserByEmail() {
      return { id: 'u1', email: 'banned@example.com', active: false }
    },
    async createSession() {
      throw new Error('must not open a session for an inactive user')
    },
  }
  const auth = createAuth({ store })
  assert.deepEqual(await auth.redeemMagicLink('lt'), { ok: false, error: 'inactive-user' })
})

// --------------------------------------------------------- requestMagicLink ---

test('requestMagicLink rejects an email without @', async () => {
  const auth = mkAuth()
  assert.deepEqual(await auth.requestMagicLink('not-an-email'), { ok: false, error: 'invalid-email' })
  assert.deepEqual(await auth.requestMagicLink(''), { ok: false, error: 'invalid-email' })
  assert.deepEqual(await auth.requestMagicLink(null), { ok: false, error: 'invalid-email' })
})

test('requestMagicLink normalizes the email and returns an opaque token', async () => {
  const auth = mkAuth()
  const res = await auth.requestMagicLink('  Alice@Example.COM ')
  assert.equal(res.ok, true)
  assert.equal(res.email, 'alice@example.com')
  assert.match(res.token, /^[A-Za-z0-9_-]+$/)
})

test('requestMagicLink does NOT create a user (identity unconfirmed)', async () => {
  const store = createMemoryStore()
  const auth = createAuth({ store })
  await auth.requestMagicLink('alice@example.com')
  assert.equal(await store.findUserByEmail('alice@example.com'), null)
})

// ---------------------------------------------------------- redeemMagicLink ---

test('redeemMagicLink rejects an unknown token', async () => {
  assert.deepEqual(await mkAuth().redeemMagicLink('ghost'), { ok: false, error: 'invalid-token' })
})

test('redeemMagicLink opens a session and creates the user on first use', async () => {
  const auth = mkAuth()
  const { token } = await auth.requestMagicLink('alice@example.com')
  const res = await auth.redeemMagicLink(token)
  assert.equal(res.ok, true)
  assert.equal(res.user.email, 'alice@example.com')
  assert.ok(res.session.token)
  assert.equal(res.session.user_id, res.user.id)
})

test('redeemMagicLink is single-use: a second redeem is rejected', async () => {
  const auth = mkAuth()
  const { token } = await auth.requestMagicLink('alice@example.com')
  await auth.redeemMagicLink(token)
  // delete-on-consume removes the spent row, so a replay finds nothing at all
  // (invalid-token) rather than a row marked consumed (used-token) - both reject.
  assert.deepEqual(await auth.redeemMagicLink(token), { ok: false, error: 'invalid-token' })
})

test('redeemMagicLink deletes the spent login token (delete-on-consume)', async () => {
  const store = createMemoryStore()
  const auth = createAuth({ store })
  const { token } = await auth.requestMagicLink('alice@example.com')
  await auth.redeemMagicLink(token)
  assert.equal(await store.findLoginToken(token), null)
  assert.deepEqual(await store.findLoginTokensByEmail('alice@example.com'), [])
})

// ----------------------------------------------- issuance rate limiting -------

test('requestMagicLink cooldown throttles a rapid second link for the same email', async () => {
  const auth = mkAuth() // default 60s cooldown
  const first = await auth.requestMagicLink('victim@example.com')
  assert.equal(first.ok, true)
  assert.ok(first.token, 'first request issues a token')

  const second = await auth.requestMagicLink('victim@example.com')
  // neutral success shape, but no token issued and no new row written
  assert.deepEqual(second, { ok: true, email: 'victim@example.com', throttled: true })

  // a different address is unaffected by the victim's cooldown
  const other = await auth.requestMagicLink('someone-else@example.com')
  assert.ok(other.token && !other.throttled)
})

test('requestMagicLink caps the number of concurrently-live links per email', async () => {
  const store = createMemoryStore()
  const auth = createAuth({ store, magicLinkCooldownMs: 0, maxActiveMagicLinks: 2 })
  const a = await auth.requestMagicLink('cap@example.com')
  const b = await auth.requestMagicLink('cap@example.com')
  const c = await auth.requestMagicLink('cap@example.com')
  assert.ok(a.token && b.token, 'first two are issued')
  assert.equal(c.throttled, true)
  assert.equal((await store.findLoginTokensByEmail('cap@example.com')).length, 2)
})

test('requestMagicLink purges consumed/expired rows so login_tokens cannot flood', async () => {
  // magicLinkTtlMs: -1 mints an already-expired token on each issue, so no link is
  // ever "live" - every request purges the previous expired row before issuing.
  const store = createMemoryStore()
  const auth = createAuth({ store, magicLinkCooldownMs: 0, magicLinkTtlMs: -1 })
  for (let i = 0; i < 5; i++) await auth.requestMagicLink('flood@example.com')
  // never more than the one row each call left behind, not five accumulated
  assert.equal((await store.findLoginTokensByEmail('flood@example.com')).length, 1)
})

test('redeemMagicLink rejects an expired token', async () => {
  const auth = mkAuth({ magicLinkTtlMs: -1000 }) // already expired at creation
  const { token } = await auth.requestMagicLink('alice@example.com')
  assert.deepEqual(await auth.redeemMagicLink(token), { ok: false, error: 'expired-token' })
})

test('redeemMagicLink reuses an existing user (find-or-create)', async () => {
  const auth = mkAuth()
  const first = await auth.redeemMagicLink((await auth.requestMagicLink('alice@example.com')).token)
  const second = await auth.redeemMagicLink((await auth.requestMagicLink('alice@example.com')).token)
  assert.equal(first.user.id, second.user.id) // same account, two sessions
  assert.notEqual(first.session.token, second.session.token)
})

// -------------------------------------------------------------- authenticate --

test('authenticate returns null for a missing or unknown token', async () => {
  const auth = mkAuth()
  assert.equal(await auth.authenticate(''), null)
  assert.equal(await auth.authenticate('nope'), null)
})

test('authenticate resolves a live session to its user', async () => {
  const auth = mkAuth()
  const { session, user } = await auth.redeemMagicLink((await auth.requestMagicLink('alice@example.com')).token)
  const resolved = await auth.authenticate(session.token)
  assert.equal(resolved.user.id, user.id)
  assert.equal(resolved.session.token, session.token)
})

test('authenticate treats an expired session as logged-out and deletes it', async () => {
  const auth = mkAuth({ sessionTtlMs: -1000 })
  const store = auth.store
  const { session } = await auth.redeemMagicLink((await auth.requestMagicLink('alice@example.com')).token)
  assert.equal(await auth.authenticate(session.token), null)
  assert.equal(await store.findSessionByToken(session.token), null) // cleaned up
})

// ------------------------------------------------------------- destroySession -

test('destroySession kills the session (real server-side logout)', async () => {
  const auth = mkAuth()
  const { session } = await auth.redeemMagicLink((await auth.requestMagicLink('alice@example.com')).token)
  await auth.destroySession(session.token)
  assert.equal(await auth.authenticate(session.token), null)
})

test('destroySession tolerates a missing token', async () => {
  await assert.doesNotReject(mkAuth().destroySession(undefined))
})
