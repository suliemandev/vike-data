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
// Org-scoped access (#109) rides on the user as `orgPermissions` / `orgRoles`:
// `{ [organizationId]: string[] }` maps the user's GROUNDED-in-an-org grants, built
// from vike-teams `memberships` (a membership's `role` name resolved through rbac's
// role -> permission grants). A user's effective access in org X is the union of
// their GLOBAL grants (role_user, app-wide) and their org-X grants.
const orgListOf = (map, org) => {
  const bag = map?.[org]
  return Array.isArray(bag) ? bag : []
}
const orgPermsOf = (user, org) => orgListOf(user?.orgPermissions, org)
const orgRolesOf = (user, org) => orgListOf(user?.orgRoles, org)

/**
 * Does this user hold `permission`? The single check the app, vike-admin, and a
 * Telefunc guard all share. Sync: it reads the permissions resolved onto the user
 * for this request (resolve.js). Denies a signed-out user and an unresolved one.
 *
 * Pass `{ org }` to check an organization context (#109): the user passes if a GLOBAL
 * role grants it OR a role they hold IN THAT ORG grants it. Without `org`, only global
 * grants count — so existing two-arg calls are unchanged (app-wide semantics).
 */
export function can(user, permission, { org } = {}) {
  if (!user || !permission) return false
  if (permsOf(user).includes(permission)) return true
  return org != null && orgPermsOf(user, org).includes(permission)
}

/**
 * Does this user have role `role` (by its stable name)? Pass `{ org }` to also match a
 * role they hold only within that organization (#109); without it, only global roles.
 */
export function hasRole(user, role, { org } = {}) {
  if (!user || !role) return false
  if (rolesOf(user).includes(role)) return true
  return org != null && orgRolesOf(user, org).includes(role)
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
 * compute the user's GLOBAL role + permission NAMES and (if org grants are supplied)
 * their per-organization role + permission NAMES. Separated from the DB reads so it is
 * unit-testable without an adapter.
 *
 *   roleUser:       [{ user_id, role_id }]              — app-wide roles (global)
 *   roles:          [{ id, name }]
 *   permissionRole: [{ role_id, permission_id }]
 *   permissions:    [{ id, name }]
 *   orgGrants:      [{ user_id?, organization_id, role }] — org-scoped roles by NAME,
 *                   the shape vike-teams `memberships` already carries (#109). A grant's
 *                   `role` is resolved through the SAME role -> permission grants, so an
 *                   org role and a global role of the same name grant the same things.
 *
 * Returns `{ roles, permissions, orgRoles, orgPermissions }` where the org maps are
 * `{ [organizationId]: string[] }`. With no orgGrants the maps are empty objects, so a
 * flat (non-multitenant) app sees exactly the old shape plus two empty maps.
 */
export function resolveUserAccess(
  userId,
  { roleUser = [], roles = [], permissionRole = [], permissions = [], orgGrants = [] } = {},
) {
  if (!userId) return { roles: [], permissions: [], orgRoles: {}, orgPermissions: {} }

  const roleNameById = new Map(roles.map((r) => [r.id, r.name]))
  const roleIdByName = new Map(roles.map((r) => [r.name, r.id]))
  const permNameById = new Map(permissions.map((p) => [p.id, p.name]))
  // role id -> the permission NAMES it grants (shared by global + org resolution).
  const permsByRoleId = new Map()
  for (const pr of permissionRole) {
    const name = permNameById.get(pr.permission_id)
    if (!name) continue
    if (!permsByRoleId.has(pr.role_id)) permsByRoleId.set(pr.role_id, new Set())
    permsByRoleId.get(pr.role_id).add(name)
  }
  const permsForRoleIds = (roleIds) => {
    const out = new Set()
    for (const id of roleIds) for (const p of permsByRoleId.get(id) || []) out.add(p)
    return [...out]
  }

  // Global: the user's app-wide role_user rows.
  const globalRoleIds = roleUser.filter((r) => r.user_id === userId).map((r) => r.role_id)
  const globalRoles = [...new Set(globalRoleIds.map((id) => roleNameById.get(id)).filter(Boolean))]

  // Org-scoped: group the user's org grants by organization, mapping each grant's role
  // NAME back to a known role so it resolves through the same permission grants. An
  // unknown role name (a membership role with no matching rbac role) grants nothing.
  const orgRoles = {}
  const orgPermissions = {}
  for (const g of orgGrants) {
    if (g.user_id != null && g.user_id !== userId) continue
    const org = g.organization_id
    const roleId = roleIdByName.get(g.role)
    if (org == null || roleId == null) continue
    ;(orgRoles[org] ||= new Set()).add(g.role)
    for (const p of permsByRoleId.get(roleId) || []) (orgPermissions[org] ||= new Set()).add(p)
  }
  // Sets -> arrays for a serializable, passToClient-friendly shape.
  for (const org of Object.keys(orgRoles)) orgRoles[org] = [...orgRoles[org]]
  for (const org of Object.keys(orgPermissions)) orgPermissions[org] = [...orgPermissions[org]]

  return { roles: globalRoles, permissions: permsForRoleIds(globalRoleIds), orgRoles, orgPermissions }
}
