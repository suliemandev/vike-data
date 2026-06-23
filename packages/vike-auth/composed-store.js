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

const USERS = 'users'
const SESSIONS = 'sessions'
const LOGIN_TOKENS = 'login_tokens'

export function createStore() {
  const memory = createMemoryStore()

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
    async consumeLoginToken(token) {
      return dispatch(
        () => memory.consumeLoginToken(token),
        async (a) => {
          const row = await firstRow(a, LOGIN_TOKENS, { token })
          if (!row || row.consumed_at) return null // unknown or already single-used
          const consumed_at = isoIn(0)
          const [updated] = await a.update(LOGIN_TOKENS, { token }, { consumed_at })
          return updated ?? { ...row, consumed_at }
        },
      )
    },
  }
}
