// Shared constants for the vike-auth server tier. Kept in one place so the
// middleware (which writes the cookie) and the onCreatePageContext hook (which
// reads it) agree on the name without importing each other.
export const SESSION_COOKIE = 'vike_auth_session'

// Default lifetimes. Magic links are short-lived and single-use; sessions are
// long-lived but server-revocable (we store them, so logout actually destroys
// them — unlike a stateless signed-token cookie).
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000 // 15 minutes
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Abuse controls on magic-link issuance (see auth.js requestMagicLink). The cooldown
// is the minimum gap between two links to the SAME email; the cap is the most
// unconsumed, unexpired links that may exist for one email at once. Together they
// throttle email-bombing a victim and bound `login_tokens` row growth per email.
// Both are durable (store-backed), so they hold across horizontally-scaled instances.
export const MAGIC_LINK_COOLDOWN_MS = 60 * 1000 // 60s between links to one email
export const MAX_ACTIVE_MAGIC_LINKS = 3 // concurrent live links per email
