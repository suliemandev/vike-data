// vike-rbac — roles & permissions as a composition primitive (#103).
//
// The shape RBAC needs is exactly the shape the rest of the Stem set already uses:
//   - it OWNS its tables (roles / permissions / role_user / permission_role) and
//     contributes them through vike-schema's cumulative `schemas` point;
//   - extensions ADVERTISE their permissions through a cumulative `permissions`
//     registry (same pattern as `schemas` / `messages` / `localePacks`), so
//     installing an extension brings its permission set with it;
//   - it provides a request-time RESOLVER (resolve.js) that enriches the signed-in
//     user with roles + permissions, so the single sync `can(user, permission)`
//     works everywhere the user object reaches: vike-admin's canView/canEdit, a page
//     guard, AND a Telefunc RPC (vike-rbac/telefunc + the telefunc seam). The
//     enrichment is contributed to vike-auth's `resolveUser` seam (see resolve.js).
//
// It self-installs vike-auth (the user is the SUBJECT of a permission check), so a
// single `extends: ['import:vike-rbac/config:default']` pulls vike-schema <-
// vike-auth <- vike-rbac.
//
// The Telefunc seam (#110) lives in the same package but is OPT-IN, not wired here:
// an app that wants guarded RPCs installs `telefunc`, adds vike-rbac/telefunc-plugin
// to vite.config (dev) / vike-rbac/telefunc-middleware to its server (prod), and
// guards telefunctions with vike-rbac/telefunc's requirePermission(). Row/resource
// scoping stays the separate `scope(user)` layer vike-admin has (#105), orthogonal
// to can().
import { rbacSchemas } from './schema.js'

export default {
  name: 'vike-rbac',
  extends: ['import:vike-auth/config:default'],
  meta: {
    // The registry extensions advertise into: a list of permission definitions
    // ({ name, label?, roles?: string[] }). Plain DATA, cumulative, like `schemas`.
    permissions: { env: { config: true, server: true, client: true }, cumulative: true },
    // The role names a brand-new user is granted on first authenticated request
    // (the "default roles on signup" seam). Cumulative + server-only: each extension
    // or the app can contribute one, and the resolver assigns the union to a user who
    // has no roles yet. Empty by default — opt in by setting `defaultRoles: ['member']`.
    defaultRoles: { env: { server: true }, cumulative: true },
    // Org-scoped roles (#109). vike-rbac stays decoupled from vike-teams: instead of
    // duplicating user+org+role on `role_user`, an app that wants per-org permissions
    // points this at the table that already holds them — vike-teams `memberships`,
    // whose `role` string IS an org-scoped role NAME. The resolver reads it and maps
    // each membership role through the SAME role -> permission grants, so can(user,
    // perm, { org }) works. Server-only, single source. `orgRoleSource: 'memberships'`
    // (or `{ table, roleColumn, orgColumn }`). Undefined -> flat, app-wide RBAC only.
    orgRoleSource: { env: { server: true } },
  },
  permissions: [],
  defaultRoles: [],
  schemas: rbacSchemas,
  // Plug the resolver into vike-auth's user-enricher seam: auth runs it right after
  // it resolves pageContext.user, on every page, so can(user, ...) works everywhere
  // (vike-admin canView/canEdit, page guards, a future Telefunc check). A
  // pointer-imported function (live code can't be inlined into serialized config).
  resolveUser: ['import:vike-rbac/resolve:resolveAccessOnto'],
}
