// The DEFAULT store wired into the auth instance. It is the Stem Vision made real:
// vike-auth owns its tables (`users`, `sessions`, `login_tokens`), and when the app
// has registered a universal-orm adapter it persists through THAT — the same data
// layer every other extension and the admin panel read. So a user who signs in via
// the magic link shows up in the admin `users` resource: one source of truth, no glue.
//
// When no adapter is registered (standalone auth, unit tests, the zero-config proof)
// it falls back to a private in-memory store, so installing vike-auth alone still
// works with no database and no universal-orm wiring.
//
// The adapter is resolved LAZILY, per operation, via getAdapter(): the auth instance
// is constructed at import time but the app registers its adapter later (in Vike's
// once-per-server onCreateGlobalContext), so the choice can only be made at call time.
// Registration happens at server start, before any request, so a process never splits
// its data across both backends.
import { getAdapter } from '@universal-orm/core'
import { newId, isoIn } from './tokens.js'
import { createMemoryStore } from './store.js'
import { resolveSubject } from './subject.js'

export function createStore() {
  const memory = createMemoryStore()

  // The tables this store reads/writes. Resolved from the SAME subject knob the schema
  // reads (subject.js), so the store always targets the tables the schema actually
  // created, defaulting to `users` / `sessions` / `login_tokens`. Resolved here at
  // store-build time (instance.js builds the store once, after the app's env is in
  // place). The memory fallback is keyless, so the names only matter on the adapter path.
  const { users: USERS, sessions: SESSIONS, loginTokens: LOGIN_TOKENS } = resolveSubject()

  // Run `viaAdapter(adapter)` when an adapter is registered, else `viaMemory()`.
  const dispatch = (viaMemory, viaAdapter) => {
    const adapter = getAdapter()
    return adapter ? viaAdapter(adapter) : viaMemory()
  }
  const firstRow = async (adapter, table, filter) => (await adapter.find(table, filter))[0] ?? null

  return {
    async findUserByEmail(email) {
      return dispatch(
        () => memory.findUserByEmail(email),
        (a) => firstRow(a, USERS, { email }),
      )
    },
    async findUserById(id) {
      return dispatch(
        () => memory.findUserById(id),
        (a) => firstRow(a, USERS, { id }),
      )
    },
    async createUser({ email }) {
      return dispatch(
        () => memory.createUser({ email }),
        (a) =>
          a.insert(USERS, {
            id: newId(),
            email,
            name: null,
            password_hash: null,
            email_verified: true, // identity confirmed by redeeming the magic link
            active: true,
            created_at: isoIn(0),
            updated_at: isoIn(0),
          }),
      )
    },

    async createSession({ userId, token, expiresAt }) {
      return dispatch(
        () => memory.createSession({ userId, token, expiresAt }),
        (a) =>
          a.insert(SESSIONS, {
            id: newId(),
            user_id: userId,
            token,
            expires_at: expiresAt,
            created_at: isoIn(0),
            updated_at: isoIn(0),
          }),
      )
    },
    async findSessionByToken(token) {
      return dispatch(
        () => memory.findSessionByToken(token),
        (a) => firstRow(a, SESSIONS, { token }),
      )
    },
    async deleteSessionByToken(token) {
      return dispatch(
        () => memory.deleteSessionByToken(token),
        async (a) => {
          await a.delete(SESSIONS, { token })
        },
      )
    },

    async createLoginToken({ email, token, expiresAt }) {
      return dispatch(
        () => memory.createLoginToken({ email, token, expiresAt }),
        (a) =>
          a.insert(LOGIN_TOKENS, {
            id: newId(),
            email,
            token,
            expires_at: expiresAt,
            consumed_at: null,
            created_at: isoIn(0),
            updated_at: isoIn(0),
          }),
      )
    },
    async findLoginToken(token) {
      return dispatch(
        () => memory.findLoginToken(token),
        (a) => firstRow(a, LOGIN_TOKENS, { token }),
      )
    },
    async findLoginTokensByEmail(email) {
      return dispatch(
        () => memory.findLoginTokensByEmail(email),
        (a) => a.find(LOGIN_TOKENS, { email }),
      )
    },
    async deleteLoginToken(token) {
      return dispatch(
        () => memory.deleteLoginToken(token),
        async (a) => {
          await a.delete(LOGIN_TOKENS, { token })
        },
      )
    },
    async consumeLoginToken(token) {
      return dispatch(
        () => memory.consumeLoginToken(token),
        async (a) => {
          // Atomic single-use: the filter includes `consumed_at: null`, so the UPDATE
          // only matches an UNCONSUMED token and compiles to `WHERE token=? AND
          // consumed_at IS NULL`. A read-then-update would race — two requests firing the
          // same magic link concurrently would both read null, both pass, and both mint a
          // session. Keying single-use on the conditional update means exactly one racer
          // matches a row; the loser gets none and is rejected.
          const consumed_at = isoIn(0)
          const [updated] = await a.update(LOGIN_TOKENS, { token, consumed_at: null }, { consumed_at })
          return updated ?? null
        },
      )
    },
  }
}
