// The SUBJECT knob: which subject vike-auth authenticates and which tables it owns.
// Defaults to `User` over `users` / `sessions` / `login_tokens` (today's behaviour,
// byte-for-byte). An app renames the subject + tables through ONE surface, and both the
// build-time schema (schemas.js) and the runtime store (composed-store.js) read it from
// HERE, so they can never disagree.
//
// Why env, not a `+config` value (the design call for P1): the schema factory CAN read a
// `+config` (Vike hands it the resolved config) but the runtime store is built at module
// IMPORT, outside any pageContext/config, so it can only see env. Routing both through env
// keeps the override a SINGLE source the app sets once, instead of a build value and a
// runtime value it must keep in sync (a build/runtime mismatch would point the store at a
// table the schema never created). This mirrors vike-stripe's runtime `BILLING_SEGMENT`.
//
// SCOPE (P1, #208): the subject + TABLE names are configurable. The FK COLUMN stays
// `user_id` (an internal column the store writes by name); only its TARGET table follows
// the rename. Multi-instance / named guards and the downstream "which subject" seam are
// P2/P3 (#207); a single process resolves exactly one subject.

// Today's names. Frozen so a caller can't mutate the shared defaults.
export const DEFAULT_SUBJECT = Object.freeze({
  subject: 'User',
  users: 'users',
  sessions: 'sessions',
  loginTokens: 'login_tokens',
})

// Map each resolved field to its env var. `subject` is the human/label name; the three
// table fields are the names threaded into the schema + store.
const ENV_KEYS = {
  subject: 'VIKE_AUTH_SUBJECT',
  users: 'VIKE_AUTH_USERS_TABLE',
  sessions: 'VIKE_AUTH_SESSIONS_TABLE',
  loginTokens: 'VIKE_AUTH_LOGIN_TOKENS_TABLE',
}

// Resolve the subject config. Precedence per field: explicit `overrides` (used by tests,
// which call the factory directly the way vike-stripe's tests call `subscriptionSchemas`)
// > env > default. `env` is injected for testability and defaults to `process.env`.
//
// A blank/whitespace-only env value is treated as unset (falls through to the default),
// so an empty `VIKE_AUTH_USERS_TABLE=` in a .env never produces a nameless table.
export function resolveSubject(overrides = {}, env = (typeof process !== 'undefined' ? process.env : {})) {
  const pick = (field) => {
    const override = overrides[field]
    if (override != null && String(override).trim() !== '') return String(override).trim()
    const fromEnv = env[ENV_KEYS[field]]
    if (fromEnv != null && String(fromEnv).trim() !== '') return String(fromEnv).trim()
    return DEFAULT_SUBJECT[field]
  }
  return {
    subject: pick('subject'),
    users: pick('users'),
    sessions: pick('sessions'),
    loginTokens: pick('loginTokens'),
  }
}
