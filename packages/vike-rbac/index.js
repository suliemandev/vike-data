// vike-rbac — the framework-agnostic POLICY CORE.
//
// The whole point of RBAC here is ONE check that every layer shares: a page guard,
// vike-admin's canView/canEdit, and (later) a Telefunc RPC all call the same
// can(user, permission). To make that check cheap and synchronous everywhere, the
// user's effective permissions are RESOLVED ONCE per request (resolve.js) onto
// `user.permissions`; the functions here are then pure lookups over that user.
//
// Zero framework imports, zero ORM imports — this is pure policy. The DB reads live
// in resolve.js (through universal-orm); the request-time wiring lives in +config.js.

/**
 * Declare an extension's permissions for the cumulative `permissions` registry.
 * Each entry is `{ name, label?, roles? }` where `roles` lists the default role
 * names that should grant it (used by seeding). Plain data — the app composes every
 * extension's set and can add or override entries.
 *
 *   definePermissions([{ name: 'users.view', label: 'View users', roles: ['admin'] }])
 */
export function definePermissions(permissions = []) {
  return permissions
}

/** Flatten the cumulative registry (array of per-source arrays) to one list. */
export function allPermissions(contributions) {
  return (contributions || []).flat().filter(Boolean)
}

// A user with no resolved permissions has none — never treat "unresolved" as
// "allowed". A signed-out user (null) is always denied.
const permsOf = (user) => (Array.isArray(user?.permissions) ? user.permissions : [])
const rolesOf = (user) => (Array.isArray(user?.roles) ? user.roles : [])

/**
 * Does this user hold `permission`? The single check the app, vike-admin, and a
 * Telefunc guard all share. Sync: it reads the permissions resolved onto the user
 * for this request (resolve.js). Denies a signed-out user and an unresolved one.
 */
export function can(user, permission) {
  if (!user || !permission) return false
  return permsOf(user).includes(permission)
}

/** Does this user have role `role` (by its stable name)? */
export function hasRole(user, role) {
  if (!user || !role) return false
  return rolesOf(user).includes(role)
}

/**
 * A Vike guard that aborts with 403 unless the user holds `permission`. Use on a
 * page (`guard: requirePermission('users.view')`); the same predicate (`can`) backs
 * an admin resource's canView or a Telefunc check, so authorization is declared once.
 */
export function requirePermission(permission) {
  return (pageContext) => {
    if (!can(pageContext.user, permission)) {
      throw renderForbidden()
    }
  }
}

function renderForbidden() {
  // Vike's render-abort shape; kept tiny so the core needs no Vike import. A
  // consumer that prefers a redirect can write its own guard around can().
  const err = new Error('Forbidden')
  err.statusCode = 403
  return err
}

/**
 * The pure resolver resolve.js builds on: given a user id and the raw join rows,
 * compute the user's role NAMES and permission NAMES. Separated from the DB reads so
 * it is unit-testable without an adapter.
 *
 *   roleUser:       [{ user_id, role_id }]
 *   roles:          [{ id, name }]
 *   permissionRole: [{ role_id, permission_id }]
 *   permissions:    [{ id, name }]
 */
export function resolveUserAccess(userId, { roleUser = [], roles = [], permissionRole = [], permissions = [] } = {}) {
  if (!userId) return { roles: [], permissions: [] }
  const roleIds = new Set(roleUser.filter((r) => r.user_id === userId).map((r) => r.role_id))
  const roleNames = roles.filter((r) => roleIds.has(r.id)).map((r) => r.name)
  const permIds = new Set(permissionRole.filter((pr) => roleIds.has(pr.role_id)).map((pr) => pr.permission_id))
  const permNames = permissions.filter((p) => permIds.has(p.id)).map((p) => p.name)
  return { roles: roleNames, permissions: permNames }
}
