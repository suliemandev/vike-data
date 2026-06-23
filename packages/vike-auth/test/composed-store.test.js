// The default store: persists through the registered universal-orm adapter when one
// is present (so auth shares its tables with the rest of the app — the admin panel
// reads the very user who just signed in), and falls back to in-memory when none is.

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createStore } from '../composed-store.js'

beforeEach(() => clearAdapter())

// ------------------------------------------------------------- fallback -------

test('no adapter registered: falls back to in-memory', async () => {
  const store = createStore()
  const u = await store.createUser({ email: 'solo@example.com' })
  assert.equal(u.email, 'solo@example.com')
  assert.equal((await store.findUserByEmail('solo@example.com')).id, u.id)
  assert.equal(await store.findUserByEmail('nobody@example.com'), null)
})

// ----------------------------------------------------- persists via adapter ---

test('with an adapter: a created user is visible THROUGH the adapter (shared)', async () => {
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  const store = createStore()

  const u = await store.createUser({ email: 'shared@example.com' })
  // reading the adapter directly is what the admin panel does — the user is there
  const rows = await adapter.find('users', { email: 'shared@example.com' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, u.id)
  assert.equal(rows[0].email_verified, true)
  assert.equal(rows[0].active, true)
})

test('sessions round-trip through the adapter', async () => {
  setAdapter(createMemoryAdapter())
  const store = createStore()
  await store.createSession({ userId: 'u1', token: 'sess', expiresAt: '2099-01-01T00:00:00.000Z' })
  assert.equal((await store.findSessionByToken('sess')).user_id, 'u1')
  await store.deleteSessionByToken('sess')
  assert.equal(await store.findSessionByToken('sess'), null)
})

test('login tokens are single-use through the adapter', async () => {
  setAdapter(createMemoryAdapter())
  const store = createStore()
  await store.createLoginToken({ email: 'x@example.com', token: 'lt', expiresAt: '2099-01-01T00:00:00.000Z' })
  const consumed = await store.consumeLoginToken('lt')
  assert.ok(consumed.consumed_at, 'consumed_at is stamped')
  assert.equal(await store.consumeLoginToken('lt'), null) // already used
  assert.equal(await store.consumeLoginToken('ghost'), null) // unknown
})

// -------------------------------------------------- the composition payoff ----

test('two store instances share one source of truth via the adapter', async () => {
  setAdapter(createMemoryAdapter())
  const auth = createStore() // what the auth instance uses
  const other = createStore() // stands in for any other reader on the same adapter
  await auth.createUser({ email: 'one@truth.io' })
  assert.ok(await other.findUserByEmail('one@truth.io'), 'the second reader sees the signup')
})
