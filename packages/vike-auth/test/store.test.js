// The in-memory Store reference implementation. A real DB-backed store must
// honour the same contract, so these tests pin that contract.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStore } from '../store.js'

test('createUser stores a verified, active user findable by id and email', async () => {
  const store = createMemoryStore()
  const user = await store.createUser({ email: 'a@b.com' })
  assert.equal(user.email, 'a@b.com')
  assert.equal(user.email_verified, true)
  assert.equal(user.active, true)
  assert.equal(await store.findUserById(user.id), user)
  assert.equal(await store.findUserByEmail('a@b.com'), user)
})

test('finders return null for unknown id/email', async () => {
  const store = createMemoryStore()
  assert.equal(await store.findUserById('nope'), null)
  assert.equal(await store.findUserByEmail('nobody@b.com'), null)
})

test('sessions can be created, found by token, and deleted', async () => {
  const store = createMemoryStore()
  const s = await store.createSession({ userId: 'u1', token: 'tok', expiresAt: '2099-01-01T00:00:00Z' })
  assert.equal(s.user_id, 'u1')
  assert.equal(await store.findSessionByToken('tok'), s)
  await store.deleteSessionByToken('tok')
  assert.equal(await store.findSessionByToken('tok'), null)
})

test('a login token is single-use: consume marks consumed_at, second consume is null', async () => {
  const store = createMemoryStore()
  await store.createLoginToken({ email: 'a@b.com', token: 'lt', expiresAt: '2099-01-01T00:00:00Z' })
  assert.equal((await store.findLoginToken('lt')).consumed_at, null)

  const first = await store.consumeLoginToken('lt')
  assert.ok(first.consumed_at)
  assert.equal(await store.consumeLoginToken('lt'), null) // already consumed
})

test('consuming an unknown login token returns null', async () => {
  const store = createMemoryStore()
  assert.equal(await store.consumeLoginToken('ghost'), null)
})
