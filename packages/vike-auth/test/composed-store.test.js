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

test('consuming a login token is an ATOMIC conditional update (single-use race-safe)', async () => {
  // Regression: a read-check-update would let two concurrent racers both pass the check
  // and both mint a session. The consume must be a single UPDATE filtered on
  // `consumed_at: null`, so exactly one racer matches. Spy the adapter to pin that filter.
  const base = createMemoryAdapter()
  let updateFilter = null
  setAdapter({
    ...base,
    update: (table, filter, patch) => {
      if (table === 'login_tokens') updateFilter = filter
      return base.update(table, filter, patch)
    },
  })
  const store = createStore()
  await store.createLoginToken({ email: 'r@example.com', token: 'race', expiresAt: '2099-01-01T00:00:00.000Z' })
  const ok = await store.consumeLoginToken('race')
  assert.ok(ok, 'first consume succeeds')
  assert.equal(updateFilter?.consumed_at, null, 'update is guarded by consumed_at: null')
  assert.equal(updateFilter?.token, 'race')
  assert.equal(await store.consumeLoginToken('race'), null) // the conditional update no longer matches
})

// -------------------------------------------------- the composition payoff ----

test('two store instances share one source of truth via the adapter', async () => {
  setAdapter(createMemoryAdapter())
  const auth = createStore() // what the auth instance uses
  const other = createStore() // stands in for any other reader on the same adapter
  await auth.createUser({ email: 'one@truth.io' })
  assert.ok(await other.findUserByEmail('one@truth.io'), 'the second reader sees the signup')
})

// ------------------------------------------------- the configurable subject ----

test('a renamed subject targets the renamed tables on the adapter path', async () => {
  // The store resolves its table names from the subject knob at build time (resolveSubject
  // reads env), so a rename must route reads/writes to the renamed tables, the SAME tables
  // schemas.js declares, not the literal `users` / `sessions` / `login_tokens`.
  const saved = process.env.VIKE_AUTH_USERS_TABLE
  process.env.VIKE_AUTH_USERS_TABLE = 'accounts'
  try {
    const adapter = createMemoryAdapter()
    setAdapter(adapter)
    const store = createStore()
    const u = await store.createUser({ email: 'renamed@example.com' })
    // The write landed in `accounts`, what the rest of the app would read.
    assert.equal((await adapter.find('accounts', { email: 'renamed@example.com' }))[0]?.id, u.id)
    assert.deepEqual(await adapter.find('users', { email: 'renamed@example.com' }), [])
    // And the store reads back from the renamed table.
    assert.equal((await store.findUserByEmail('renamed@example.com')).id, u.id)
  } finally {
    if (saved === undefined) delete process.env.VIKE_AUTH_USERS_TABLE
    else process.env.VIKE_AUTH_USERS_TABLE = saved
  }
})

test('a renamed contact column persists physically but the store still returns canonical `email`', async () => {
  // The DB row is keyed by the physical column (`account_email`), but the auth core,
  // resolveSessionUser and every downstream reader must keep seeing `user.email`. The store
  // is the containment boundary: it writes/filters the physical column, normalizes on the
  // way out.
  const saved = process.env.VIKE_AUTH_EMAIL_COLUMN
  process.env.VIKE_AUTH_EMAIL_COLUMN = 'account_email'
  try {
    const adapter = createMemoryAdapter()
    setAdapter(adapter)
    const store = createStore()

    const created = await store.createUser({ email: 'col@example.com' })
    // Canonical shape OUT (no physical column leaks to callers)...
    assert.equal(created.email, 'col@example.com')
    assert.equal(created.account_email, undefined)
    // ...while the row landed under the PHYSICAL column the schema declared.
    const [row] = await adapter.find('users', { account_email: 'col@example.com' })
    assert.equal(row.account_email, 'col@example.com')
    assert.equal(row.email, undefined)

    // Lookups filter by the physical column and still hand back canonical `email`.
    const byEmail = await store.findUserByEmail('col@example.com')
    assert.equal(byEmail.id, created.id)
    assert.equal(byEmail.email, 'col@example.com')
    const byId = await store.findUserById(created.id)
    assert.equal(byId.email, 'col@example.com')
    assert.equal(byId.account_email, undefined)
  } finally {
    if (saved === undefined) delete process.env.VIKE_AUTH_EMAIL_COLUMN
    else process.env.VIKE_AUTH_EMAIL_COLUMN = saved
  }
})
