# vike-rbac

Roles & permissions for vike-data: owns `roles` / `permissions` / `role_user` /
`permission_role`, a cumulative `permissions` registry, and a single
`can(user, permission)` / `hasRole(user, role)` that pages, [vike-admin](../vike-admin),
and a Telefunc RPC seam all share. It composes on [vike-auth](../vike-auth) (the user is
the permission subject) and resolves access onto `pageContext.user` on every request.

## Usage

```js
// +config.js
import rbacExt from 'vike-rbac/config'

export default {
  extends: [authExt, rbacExt],     // rbac self-installs vike-auth
  defaultRoles: ['member'],        // role granted to a brand-new signup on first request
}
```

Extensions declare the permissions they own; the app composes them and seeds the DB:

```js
import { definePermissions } from 'vike-rbac'

export default {
  extends: ['import:vike-rbac/config:default'],
  permissions: definePermissions([{ name: 'widgets.edit', roles: ['admin'] }]),
}
```

Then check anywhere the user is resolved:

```js
import { can, hasRole } from 'vike-rbac'
if (!can(pageContext.user, 'widgets.edit')) throw render(403)
```

## Exports

| Subpath | What |
|---|---|
| `.` | `can` / `hasRole` / `definePermissions` / `allPermissions` / `resolveUserAccess` (pure). |
| `./config` | The Vike config: cumulative `permissions`, plus `defaultRoles` and `orgRoleSource`. |
| `./schema` | The RBAC table definitions. |
| `./resolve` | The request-time resolver that enriches `pageContext.user` with roles + permissions. |
| `./seed` | `seedRbac()` / `assignRoles()` — materialize roles/permissions/grants from the registry (idempotent). |
| `./telefunc`, `./telefunc-context`, `./telefunc-middleware`, `./telefunc-plugin` | Guard Telefunc RPCs with the same `can()` (dev Vite plugin + prod universal middleware). |

## Key concepts

- **One check everywhere.** The admin's `canView`/`canEdit`, a page guard, a session
  `scope`, and a guarded RPC all delegate to the same `can(user, permission)`.
- **Resolution rides on vike-auth.** `resolve.js` runs in vike-auth's `resolveUser`
  seam right after the user is resolved, so the check is **sync** on every page.
- **Seed-from-registry.** `seedRbac()` derives the roles/permissions/grants from the
  composed `permissions` registry — no hand-written seed list.
- **Org-scoped roles.** With `orgRoleSource: 'memberships'`, per-organization role
  grants are read from [vike-teams](../vike-teams); `can(user, perm, { org })` checks
  global ∪ org access. The page enricher records the configured `orgRoleSource`, and the
  RPC seam reads org grants from the same source, so `requirePermission('x', { org })`
  authorizes identically on a page and over Telefunc. (A server can also call
  `setOrgRoleSource('memberships')` at startup for an RPC that precedes any page render.)
- **Telefunc seam.** `requirePermission()` reads the signed-in, role-enriched user off
  the Telefunc context, so a server function is authorized by exactly what `canView`
  enforces.
