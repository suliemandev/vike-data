// The persistence SEAM. The auth core never touches a database directly; it
// talks to this Store interface, whose operations map 1:1 onto the tables
// vike-auth declares through the schema DSL (`users`, `sessions`,
// `login_tokens`). That is the whole point of the Stem Vision: the extension
// owns its schema AND the narrow set of queries over it.
//
// `createMemoryStore()` is the in-process implementation used by the proof (the
// repo has no real database yet — see the root README). A real app would supply
// a store backed by the generated ORM artifacts; the auth core is identical
// either way. Every method is async so a DB-backed store is a drop-in.
//
// @typedef {Object} Store
// users
//   findUserByEmail(email)            -> user | null
//   findUserById(id)                  -> user | null
//   createUser({ email })             -> user            (email_verified true on creation via magic link)
// sessions
//   createSession({ userId, token, expiresAt }) -> session
//   findSessionByToken(token)         -> session | null
//   deleteSessionByToken(token)       -> void
// login tokens (pending magic links)
//   createLoginToken({ email, token, expiresAt }) -> loginToken
//   findLoginToken(token)             -> loginToken | null
//   consumeLoginToken(token)          -> loginToken | null   (marks consumed_at, single-use)

import { newId, isoIn } from './tokens.js'

export function createMemoryStore() {
  const usersById = new Map()
  const usersByEmail = new Map()
  const sessionsByToken = new Map()
  const loginTokens = new Map()

  return {
    async findUserByEmail(email) {
      return usersByEmail.get(email) ?? null
    },
    async findUserById(id) {
      return usersById.get(id) ?? null
    },
    async createUser({ email }) {
      const user = {
        id: newId(),
        email,
        name: null,
        password_hash: null,
        email_verified: true,
        active: true,
        created_at: isoIn(0),
        updated_at: isoIn(0),
      }
      usersById.set(user.id, user)
      usersByEmail.set(user.email, user)
      return user
    },

    async createSession({ userId, token, expiresAt }) {
      const session = {
        id: newId(),
        user_id: userId,
        token,
        expires_at: expiresAt,
        created_at: isoIn(0),
        updated_at: isoIn(0),
      }
      sessionsByToken.set(token, session)
      return session
    },
    async findSessionByToken(token) {
      return sessionsByToken.get(token) ?? null
    },
    async deleteSessionByToken(token) {
      sessionsByToken.delete(token)
    },

    async createLoginToken({ email, token, expiresAt }) {
      const row = {
        id: newId(),
        email,
        token,
        expires_at: expiresAt,
        consumed_at: null,
        created_at: isoIn(0),
        updated_at: isoIn(0),
      }
      loginTokens.set(token, row)
      return row
    },
    async findLoginToken(token) {
      return loginTokens.get(token) ?? null
    },
    async consumeLoginToken(token) {
      const row = loginTokens.get(token)
      if (!row || row.consumed_at) return null
      row.consumed_at = isoIn(0)
      return row
    },
  }
}
