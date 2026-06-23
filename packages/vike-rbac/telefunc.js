// vike-rbac/telefunc — the RPC half of the seam (#110).
//
// The whole premise of vike-rbac is ONE authorization check shared by every
// layer. A page guard calls `requirePermission('x')` (index.js); vike-admin's
// canView/canEdit call `can(user, 'x')`; here a Telefunc RPC calls the SAME
// `can()` on the SAME enriched user. The unifying insight from #103: the guard
// that protects a page must also protect the RPC behind it, or the RPC is a hole
// around the UI's authorization.
//
// A telefunction reads its user from Telefunc's request context (getContext),
// which the telefunc-middleware.js seam populates by re-resolving the session
// user and enriching it with rbac roles/permissions — the same object shape the
// page enricher attaches. So the checks below are the exact `can()`/`hasRole()`
// lookups, just sourced from the Telefunc context instead of pageContext.
//
// Denial uses Telefunc's `Abort`: an EXPECTED control-flow signal (a forbidden
// call is not a bug), serialized to a 403 the client can branch on via
// `err.isAbort` / `err.abortValue`. This module imports `telefunc` directly — it
// is only ever imported by an app's `*.telefunc.js` files, which exist only when
// telefunc is set up, so the dependency is always present where this runs.
import { getContext, Abort } from 'telefunc'
import { can, hasRole } from './index.js'

// --- testable cores: take an explicit user, throw Abort on denial ------------
// Kept separate from the getContext() wrappers so they can be unit-tested without
// a live Telefunc request (and reused if a caller already holds the user).

/** Throw Abort unless `user` is signed in; otherwise return the user. */
export function checkUser(user) {
  if (!user) throw Abort('Unauthorized')
  return user
}

/** Throw Abort unless `user` holds `permission` (optionally in `{ org }`). */
export function checkPermission(user, permission, opts = {}) {
  if (!can(user, permission, opts)) throw Abort('Forbidden')
  return user
}

/** Throw Abort unless `user` has `role` (optionally in `{ org }`). */
export function checkRole(user, role, opts = {}) {
  if (!hasRole(user, role, opts)) throw Abort('Forbidden')
  return user
}

// --- telefunction guards: read the user from the Telefunc context ------------
// Call these at the TOP of a telefunction, before its first `await` — Telefunc's
// getContext() must run before any async hop (telefunc.com/getContext).

/** The signed-in user from the Telefunc context, or throw Abort (401-ish). */
export function currentUser() {
  return checkUser(getContext().user)
}

/** Guard a telefunction: the caller must hold `permission`. Returns the user. */
export function requirePermission(permission, opts = {}) {
  return checkPermission(getContext().user, permission, opts)
}

/** Guard a telefunction: the caller must have `role`. Returns the user. */
export function requireRole(role, opts = {}) {
  return checkRole(getContext().user, role, opts)
}

// Re-export the pure predicates so a telefunction can branch on access without
// aborting (e.g. return a narrower payload to a non-admin), using the same core.
export { can, hasRole }
