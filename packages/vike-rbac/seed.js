// Materialize the RBAC tables from the cumulative `permissions` registry — the
// inverse of resolve.js. resolve.js READS the join rows to answer can(); this
// WRITES them from the declared intent, so an app never hand-seeds roles/grants.
//
// The registry is plain data every installed extension advertises (definePermissions
// in index.js): a list of `{ name, label?, roles?: string[] }`. From it the whole flat
// model is DERIVED, no extra source of truth:
//   - permissions      : one row per distinct entry `name` (carrying its `label`),
//   - roles            : the union of every entry's `roles` (the default role set),
//   - permission_role  : a grant for each (role in entry.roles) -> entry.name.
//
// So installing an extension brings its permission set with it, and seeding is just
// the composition of what's installed. Seeding was the open question in #103.
//
// Everything here is idempotent (look up by stable `name`, insert only what's
// missing) so it is safe to run on every boot or from a migration seed, and a row's
// id is never rewritten on a re-seed — the FKs in role_user / permission_role stay
// stable. Works against any universal-orm adapter (table-first find/insert).
import { allPermissions } from './index.js'

const newId = () => globalThis.crypto.randomUUID()
const stamp = () => {
  const at = new Date().toISOString()
  return { created_at: at, updated_at: at }
}

// Find a row by a unique column, else insert it. Returns the row either way, so the
// caller gets a stable id to wire joins against. The lookup keeps re-seeds idempotent.
async function findOrCreate(adapter, table, where, extra = {}) {
  const existing = (await adapter.find(table, where))[0]
  if (existing) return existing
  return adapter.insert(table, { id: newId(), ...where, ...extra, ...stamp() })
}

/**
 * The distinct default role names declared across the registry (the union of every
 * permission entry's `roles`). The set seedRbac creates and a sensible source for an
 * app's default-role-on-signup list when it wants "every role that exists".
 */
export function rolesInRegistry(registry) {
  const names = allPermissions(registry).flatMap((p) => (Array.isArray(p.roles) ? p.roles : []))
  return [...new Set(names.filter(Boolean))]
}

/**
 * Seed roles, permissions, and role->permission grants from the cumulative
 * `permissions` registry. Idempotent: existing rows (matched by `name`) are reused,
 * only missing ones are inserted, and no id is rewritten. Returns the materialized
 * roles/permissions/grants so a caller can log or assert what was composed.
 *
 *   await seedRbac(adapter, allExtensionPermissions)
 *
 * `registry` accepts either the cumulative array-of-per-source-arrays Vike composes
 * or an already-flat list — allPermissions() normalizes both.
 *
 * `opts.roles` adds standalone role names to materialize that no permission grants
 * (e.g. a `member` default role that only gates membership, not a capability) — they
 * exist so hasRole()/default-role assignment can reference them.
 */
export async function seedRbac(adapter, registry, { roles: extraRoles = [] } = {}) {
  if (!adapter) throw new Error('[vike-rbac] seedRbac requires a universal-orm adapter')
  const defs = allPermissions(registry)

  // Roles first (grants reference them). One row per distinct role name — the union of
  // the roles the registry grants and any standalone `opts.roles`.
  const roleNames = [...new Set([...rolesInRegistry(defs), ...extraRoles.filter(Boolean)])]
  const roleByName = new Map()
  for (const name of roleNames) {
    roleByName.set(name, await findOrCreate(adapter, 'roles', { name }, { label: null }))
  }

  // Permissions: one row per distinct entry name; a later entry's label fills a gap
  // but never clobbers an existing one (first non-null wins, deterministic).
  const permByName = new Map()
  for (const def of defs) {
    if (!def?.name || permByName.has(def.name)) continue
    permByName.set(def.name, await findOrCreate(adapter, 'permissions', { name: def.name }, { label: def.label ?? null }))
  }

  // Grants: for every entry, each of its `roles` is granted that permission.
  const grants = []
  for (const def of defs) {
    if (!def?.name || !Array.isArray(def.roles)) continue
    const permission = permByName.get(def.name)
    for (const roleName of def.roles) {
      const role = roleByName.get(roleName)
      if (!role || !permission) continue
      grants.push(
        await findOrCreate(adapter, 'permission_role', { role_id: role.id, permission_id: permission.id }),
      )
    }
  }

  return { roles: [...roleByName.values()], permissions: [...permByName.values()], grants }
}

/**
 * Assign one or more roles (by stable name) to a user — the primitive behind
 * "default roles on signup". Idempotent (skips a grant the user already has) and a
 * no-op for an unknown role name, so it is safe to call on every sign-in. The roles
 * must already exist (seedRbac, or a migration). Returns the role_user rows created.
 *
 *   await assignRoles(adapter, user.id, ['member'])
 */
export async function assignRoles(adapter, userId, roleNames = []) {
  if (!adapter || !userId) return []
  const names = Array.isArray(roleNames) ? roleNames : [roleNames]
  const created = []
  for (const name of names) {
    if (!name) continue
    const role = (await adapter.find('roles', { name }))[0]
    if (!role) continue // unknown role -> no-op; seed it first
    const existing = (await adapter.find('role_user', { user_id: userId, role_id: role.id }))[0]
    if (existing) continue
    created.push(await adapter.insert('role_user', { id: newId(), user_id: userId, role_id: role.id, ...stamp() }))
  }
  return created
}
