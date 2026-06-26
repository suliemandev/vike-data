// NAMED GUARDS (#267) — Laravel "guards": run vike-auth more than once in one app, each
// instance authenticating a DIFFERENT subject against DIFFERENT tables, with its own login
// endpoint, session cookie, and resolved user. An `admin` guard over `admins` and a
// `client` guard over `clients` coexist with zero cross-talk; signing into one leaves the
// other untouched.
//
// This is the `many` variant of the single auth instance (instance.js): AUTHORING.md
// seam 10 (a runtime registry keyed by name + a dispatcher), the same shape as
// vike-queue's jobs and vike-notifications' channels. The app declares each guard ONCE
// with `defineGuard(name, config)` in a shared module it imports from BOTH its `+config`
// (to contribute the guard's tables to the cumulative `schemas` point) and its server
// start (so the runtime middleware / render hook see the instance). `defineGuard` both
// registers the instance AND returns the guard's schemas, so the app declares it once and
// wires the two halves from the one descriptor.
//
// THE DEFAULT IS UNTOUCHED. A guard is strictly additive: an app that calls no
// `defineGuard` keeps the byte-for-byte single-subject path (`/login`, `/auth/*`,
// `vike_auth_session`, `pageContext.user`). Guards are opt-in (install the guards config,
// declare guards); the moat — zero-config default-User — stays.
import { createSubjectResolver } from '@vike-data/kit'
import { createAuth } from './auth.js'
import { createStore } from './composed-store.js'
import { buildSubjectSchemas } from './schema-factory.js'
import { DEFAULT_SUBJECT } from './subject.js'
import { SESSION_COOKIE } from './constants.js'

// The guard registry, on globalThis so duplicate module evaluation (pointer imports, dev
// HMR) can't fork it — every code path (middleware, render hook, schema factory) sees the
// same guards. A Map keyed by guard name, the seam-10 shape.
const KEY = Symbol.for('vike-auth.guards')
/** @type {Map<string, object>} */
const registry = globalThis[KEY] || (globalThis[KEY] = new Map())

// Resolve a guard's subject from EXPLICIT config (override > default), with NO env read:
// unlike the default subject (subject.js, env-backed so the app sets it once), a guard's
// identity is passed directly to defineGuard, so reading VIKE_AUTH_* here would wrongly
// bleed the default guard's env onto every named one. Reuses kit's resolver (same
// precedence + blank-guard) so a guard's subject shape can't drift from the default's.
const resolveGuardSubject = createSubjectResolver(DEFAULT_SUBJECT, {})

// A guard name becomes a URL segment (`/<name>-auth/*`) and a cookie suffix
// (`vike_auth_session__<name>`), so it must be lowercase, url- and cookie-safe, and start
// with a letter. Reject anything else loudly at declaration time rather than mint a broken
// route/cookie.
const NAME_RE = /^[a-z][a-z0-9-]*$/

/**
 * Declare a named guard. Idempotent per name (HMR / double import return the existing
 * descriptor). Returns `{ name, subject, cookieName, basePath, instance, schemas }`.
 *
 * @param {string} name  e.g. 'admin' — the guard's url/cookie key AND the first half of its
 *   default table names.
 * @param {object} config  `{ table, sessionTable?, loginTokenTable?, emailColumn? }`:
 *   - `table` (REQUIRED) — the subject table (e.g. `admins`). The one name that can't be
 *     guessed from `name` safely (plurals: `company` -> `companys`), so it's explicit.
 *   - `sessionTable` — defaults to `<name>_sessions`.
 *   - `loginTokenTable` — defaults to `<name>_login_tokens`.
 *   - `emailColumn` — optional renamed contact column (defaults to `email`).
 */
export function defineGuard(name, config = {}) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new Error(`[vike-auth] defineGuard: invalid guard name ${JSON.stringify(name)} (use lowercase letters, digits and hyphens, starting with a letter)`)
  }
  const { table, sessionTable, loginTokenTable, emailColumn } = config
  if (typeof table !== 'string' || !table.trim()) {
    throw new Error(`[vike-auth] defineGuard('${name}'): a \`table\` (the subject table, e.g. '${name}s') is required`)
  }
  // Idempotent: a second call for the same name (HMR, or the app importing its guards
  // module on both the config and the server path) returns the already-built descriptor
  // instead of forking a second instance over the same tables.
  const existing = registry.get(name)
  if (existing) return existing

  // Map the friendly guard keys onto the internal subject shape the store + schema read
  // (`users`/`sessions`/`loginTokens`), defaulting the session + token tables from the
  // guard name so the common case is just `{ table }`. `subject` (the label) is unused on
  // the guard path, so it's set to the name only to satisfy the shared resolver shape.
  const subject = resolveGuardSubject({
    subject: name,
    users: table,
    sessions: sessionTable || `${name}_sessions`,
    loginTokens: loginTokenTable || `${name}_login_tokens`,
    emailColumn,
  })
  // Each guard gets its OWN cookie and endpoint namespace, derived from the name. The
  // default guard keeps the bare `vike_auth_session` / `/auth`; a named one is suffixed
  // so two guards never read or clobber each other's session.
  const cookieName = `${SESSION_COOKIE}__${name}`
  const basePath = `/${name}-auth`
  // The guard's own auth instance over its own tables (createStore(subject) targets the
  // guard's `admins` / `admin_sessions` / ... through the registered adapter, falling back
  // to a private in-memory store when none is registered — exactly like the default).
  const instance = createAuth({ store: createStore(subject) })

  // The guard's tables — the same three the default owns, under the guard's names — so the
  // app spreads `guard.schemas` into the cumulative `schemas` point and they merge + derive
  // to every ORM alongside the default's.
  const schemas = buildSubjectSchemas(subject)
  const descriptor = { name, subject, cookieName, basePath, instance, schemas }
  registry.set(name, descriptor)
  return descriptor
}

/** Read one guard by name, or null. */
export const getGuard = (name) => registry.get(name) || null

/** All declared guards (the dispatcher fans out over these). */
export const getGuards = () => [...registry.values()]
