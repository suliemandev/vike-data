// NAMED GUARDS (#267) — Laravel "guards": run vike-auth more than once in one app, each
// instance authenticating a DIFFERENT subject against DIFFERENT tables, with its own login
// endpoint, session cookie, and resolved user. An `admin` guard over `admins` and a
// `client` guard over `clients` coexist with zero cross-talk; signing into one leaves the
// other untouched.
//
// This is AUTHORING.md seam 10 (a runtime registry keyed by name + a dispatcher), the same
// shape as vike-queue's jobs and vike-notifications' channels. The app declares each guard
// ONCE with `defineGuard(name, config)` in a shared module it imports from BOTH its
// `+config` (to contribute the guard's tables to the cumulative `schemas` point) and its
// server start (so the runtime middleware / render hook see the instance). `defineGuard`
// both registers the instance AND returns the guard's schemas, so the app declares it once
// and wires the two halves from the one descriptor.
//
// ONE MODEL (#276). The default, primary subject is itself a guard — the DEFAULT GUARD —
// expressed through the exact same descriptor shape (getDefaultGuard()), just with the bare
// `vike_auth_session` cookie + `/auth` base and `default: true`. So there is a single notion
// of "an audience": the default plus any named ones, all enumerable through getAllGuards().
//
// TWO ON-RAMPS, not two models. The default guard takes its config from ENV (resolveSubject,
// the zero-code path for a one-subject app); a named guard takes it from the defineGuard
// argument. A guard is strictly additive: an app that calls no `defineGuard` keeps the
// byte-for-byte single-subject path (`/login`, `/auth/*`, `vike_auth_session`,
// `pageContext.user`); named guards are opt-in. The moat — zero-config default subject — stays.
import { createSubjectResolver } from '@vike-data/kit'
import { createAuth } from './auth.js'
import { createStore } from './composed-store.js'
import { buildSubjectSchemas } from './schema-factory.js'
import { DEFAULT_SUBJECT, resolveSubject } from './subject.js'
import { SESSION_COOKIE } from './constants.js'

// The guard registry, on globalThis so duplicate module evaluation (pointer imports, dev
// HMR) can't fork it — every code path (middleware, render hook, schema factory) sees the
// same guards. A Map keyed by guard name, the seam-10 shape. This holds the NAMED guards;
// the default guard (the env-configured primary subject) lives in its own globalThis slot
// below, exposed through the same descriptor shape — one model, two on-ramps (#276).
const KEY = Symbol.for('vike-auth.guards')
/** @type {Map<string, object>} */
const registry = globalThis[KEY] || (globalThis[KEY] = new Map())

// The reserved name of the default guard (the primary, env-configured subject). An app
// can't `defineGuard('default', ...)` — that identity belongs to the default subject.
export const DEFAULT_GUARD_NAME = 'default'

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

// Build a guard descriptor — the ONE shape every audience takes, the default and each named
// guard alike. Its specialness is pure data: the default carries the bare `vike_auth_session`
// cookie + `/auth` base, a named guard a suffixed cookie + `/<name>-auth`. Both get an auth
// instance over their own tables (createStore(subject)) and the same three schema fragments.
function buildDescriptor({ name, subject, cookieName, basePath, isDefault = false }) {
  return {
    name,
    subject,
    cookieName,
    basePath,
    instance: createAuth({ store: createStore(subject) }),
    schemas: buildSubjectSchemas(subject),
    default: isDefault,
  }
}

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
  if (name === DEFAULT_GUARD_NAME) {
    throw new Error(`[vike-auth] defineGuard: '${DEFAULT_GUARD_NAME}' is reserved for the default subject; configure it via env (VIKE_AUTH_SUBJECT_TABLE, ...) instead`)
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
  // guard name so the common case is just `{ table }`.
  const subject = resolveGuardSubject({
    users: table,
    sessions: sessionTable || `${name}_sessions`,
    loginTokens: loginTokenTable || `${name}_login_tokens`,
    emailColumn,
  })
  // A named guard gets its OWN cookie + endpoint namespace, suffixed by the name so two
  // guards never read or clobber each other's session.
  const descriptor = buildDescriptor({
    name,
    subject,
    cookieName: `${SESSION_COOKIE}__${name}`,
    basePath: `/${name}-auth`,
  })
  registry.set(name, descriptor)
  return descriptor
}

// The DEFAULT guard: the primary, env-configured subject, expressed through the same
// descriptor shape as a named guard but with the bare `vike_auth_session` cookie + `/auth`
// base + `default: true`. Built lazily on first access and cached on globalThis (so HMR /
// duplicate module eval can't fork the default store) — this is the single home of the
// default auth instance that instance.js, the default middleware and the render hook share.
// Its subject is read from env (resolveSubject()), the zero-code on-ramp for a one-subject
// app; a named guard takes its config from defineGuard instead.
const DEFAULT_KEY = Symbol.for('vike-auth.default-guard')
export function getDefaultGuard() {
  if (!globalThis[DEFAULT_KEY]) {
    globalThis[DEFAULT_KEY] = buildDescriptor({
      name: DEFAULT_GUARD_NAME,
      subject: resolveSubject(),
      cookieName: SESSION_COOKIE,
      basePath: '/auth',
      isDefault: true,
    })
  }
  return globalThis[DEFAULT_KEY]
}

/** Read one guard by name (incl. the default), or null. */
export const getGuard = (name) => (name === DEFAULT_GUARD_NAME ? getDefaultGuard() : registry.get(name)) || null

/** The NAMED guards (the named-guard dispatcher + render hook fan out over these). */
export const getGuards = () => [...registry.values()]

/**
 * EVERY audience — the default guard followed by the named ones — as uniform descriptors.
 * The enumeration seam for downstream "which subject" work (#207 P3): a consumer that binds
 * to a subject can resolve any of them through one shape, default included.
 */
export const getAllGuards = () => [getDefaultGuard(), ...registry.values()]
