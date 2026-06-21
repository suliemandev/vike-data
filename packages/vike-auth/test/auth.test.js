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
  assert.deepEqual(await auth.redeemMagicLink(token), { ok: false, error: 'used-token' })
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
