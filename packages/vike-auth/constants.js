// Shared constants for the vike-auth server tier. Kept in one place so the
// middleware (which writes the cookie) and the onCreatePageContext hook (which
// reads it) agree on the name without importing each other.
export const SESSION_COOKIE = 'vike_auth_session'

// Default lifetimes. Magic links are short-lived and single-use; sessions are
// long-lived but server-revocable (we store them, so logout actually destroys
// them — unlike a stateless signed-token cookie).
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000 // 15 minutes
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
