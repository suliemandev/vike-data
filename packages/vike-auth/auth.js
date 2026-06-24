// The framework-agnostic, ORM-agnostic auth CORE. No Vike, no HTTP, no cookies
// here — just the session + magic-link lifecycle over a Store (store.js). The
// Vike binding (middleware.js / oncreate.js) is a thin shell that turns HTTP
// requests into these calls and the results into cookies + redirects.
//
// Model: passwordless magic links backed by real tables.
//   requestMagicLink(email) -> stores a single-use, short-lived login token
//   redeemMagicLink(token)  -> verifies it, upserts the user, opens a session
//   authenticate(token)     -> resolves a session cookie to its user
//   destroySession(token)   -> real server-side logout (the row is deleted)
//
// Sessions are STATEFUL (opaque token stored in `sessions`). That is a
// deliberate contrast with the vike-dashboard reference, which uses a stateless
// Ed25519-signed cookie and therefore cannot revoke a single session. Storing
// the session exercises the schema this extension already owns and makes logout
// mean something. See the README design note.

import { MAGIC_LINK_TTL_MS, SESSION_TTL_MS } from './constants.js'
import { newToken, isoIn, isExpired } from './tokens.js'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

export function createAuth({
  store,
  magicLinkTtlMs = MAGIC_LINK_TTL_MS,
  sessionTtlMs = SESSION_TTL_MS,
} = {}) {
  if (!store) throw new Error('[vike-auth] createAuth requires a { store }')

  return {
    store,

    // Issue a magic link for an email. We do NOT create the user yet — identity
    // is only confirmed once the link is followed (so a typo'd email never mints
    // an account). Returns the opaque token; the caller builds + delivers the URL.
    async requestMagicLink(rawEmail) {
      const email = normalizeEmail(rawEmail)
      if (!email || !email.includes('@')) {
        return { ok: false, error: 'invalid-email' }
      }
      const token = newToken()
      await store.createLoginToken({ email, token, expiresAt: isoIn(magicLinkTtlMs) })
      return { ok: true, email, token }
    },

    // Verify a magic-link token: single-use (consume it), unexpired, then
    // find-or-create the user (passwordless signup) and open a session.
    async redeemMagicLink(token) {
      const pending = await store.findLoginToken(token)
      if (!pending) return { ok: false, error: 'invalid-token' }
      if (pending.consumed_at) return { ok: false, error: 'used-token' }
      if (isExpired(pending.expires_at)) return { ok: false, error: 'expired-token' }

      const consumed = await store.consumeLoginToken(token)
      if (!consumed) return { ok: false, error: 'used-token' } // lost a race

      let user = await store.findUserByEmail(pending.email)
      if (!user) user = await store.createUser({ email: pending.email })
      // A deactivated account can't sign in. `active` is set on every user; treat only an
      // EXPLICIT `false` as deactivated (a legacy row without the column reads as active).
      if (user.active === false) return { ok: false, error: 'inactive-user' }

      const session = await store.createSession({
        userId: user.id,
        token: newToken(),
        expiresAt: isoIn(sessionTtlMs),
      })
      return { ok: true, user, session }
    },

    // Resolve a session-cookie token to its user. Expired sessions are cleaned
    // up as a side effect, so a stale cookie reads as logged-out.
    async authenticate(token) {
      if (!token) return null
      const session = await store.findSessionByToken(token)
      if (!session) return null
      if (isExpired(session.expires_at)) {
        await store.deleteSessionByToken(token)
        return null
      }
      const user = await store.findUserById(session.user_id)
      if (!user) return null
      // A user deactivated mid-session is logged out: tear down the live session so the
      // stale cookie reads as logged-out from here on, the same as an expired one.
      if (user.active === false) {
        await store.deleteSessionByToken(token)
        return null
      }
      return { user, session }
    },

    // Real logout: the session row is destroyed, so the token is dead even if the
    // cookie lingers.
    async destroySession(token) {
      if (token) await store.deleteSessionByToken(token)
    },

    sessionTtlMs,
  }
}
