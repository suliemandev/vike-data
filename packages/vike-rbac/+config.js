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
//     works everywhere the user object reaches: vike-admin's canView/canEdit and
//     (later) a Telefunc RPC. The app wires it from an onCreatePageContext (see
//     resolve.js for why app-level); self-wiring is a follow-up.
//
// It self-installs vike-auth (the user is the SUBJECT of a permission check), so a
// single `extends: ['import:vike-rbac/config:default']` pulls vike-schema <-
// vike-auth <- vike-rbac.
//
// DELIBERATELY OUT OF SCOPE for this first tier (pending the brillout call):
// org-scoped roles / multi-tenancy (a later column on role_user, gated on the
// teams/org model) and the Telefunc seam. Row/resource scoping is the separate
// `scope(user)` layer vike-admin already has (#105), orthogonal to can().
import { rbacSchemas } from './schema.js'

export default {
  name: 'vike-rbac',
  extends: ['import:vike-auth/config:default'],
  meta: {
    // The registry extensions advertise into: a list of permission definitions
    // ({ name, label?, roles?: string[] }). Plain DATA, cumulative, like `schemas`.
    permissions: { env: { config: true, server: true, client: true }, cumulative: true },
  },
  permissions: [],
  schemas: rbacSchemas,
  // Plug the resolver into vike-auth's user-enricher seam: auth runs it right after
  // it resolves pageContext.user, on every page, so can(user, ...) works everywhere
  // (vike-admin canView/canEdit, page guards, a future Telefunc check). A
  // pointer-imported function (live code can't be inlined into serialized config).
  resolveUser: ['import:vike-rbac/resolve:resolveAccessOnto'],
}
