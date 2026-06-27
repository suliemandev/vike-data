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

### Guarded RPCs (Telefunc)

To run the same `can()` on a Telefunc RPC, install `telefunc` and wire ONE universal middleware — it serves dev and prod alike, because the seam relocates telefunc's endpoint off the default `/_telefunc` so telefunc's own context-less dev middleware never intercepts the call (#128):

```js
// pages/+config.js
export default {
  middleware: ['import:vike-rbac/telefunc-middleware:default'], // server: owns the RPC endpoint, with context
}
```

```js
// pages/+client.js — point the browser telefunc client at the relocated endpoint
import 'vike-rbac/telefunc-client'
```

Then guard a telefunction with the same check the page uses:

```js
// stats.telefunc.js
import { requirePermission } from 'vike-rbac/telefunc'
export async function userCount() {
  requirePermission('users.view') // Telefunc Abort (403) unless allowed — the same can() as the page
  /* ... */
}
```

No Vite plugin is needed (the old dev-only `telefunc-plugin` is retired).

## Exports

| Subpath | What |
|---|---|
| `.` | `can` / `hasRole` / `definePermissions` / `allPermissions` / `resolveUserAccess` (pure). |
| `./config` | The Vike config: cumulative `permissions`, plus `defaultRoles`, `orgRoleSource`, and `rbacGuard`. |
| `./schema` | The RBAC table definitions. |
| `./resolve` | The request-time resolver that enriches `pageContext.user` with roles + permissions. |
| `./seed` | `seedRbac()` / `assignRoles()` — materialize roles/permissions/grants from the registry (idempotent). |
| `./telefunc`, `./telefunc-context`, `./telefunc-middleware`, `./telefunc-client`, `./telefunc-url` | Guard Telefunc RPCs with the same `can()` — ONE universal middleware for dev and prod (the endpoint is relocated off telefunc's default `/_telefunc`, so telefunc's own context-less dev middleware never intercepts it). |

## Key concepts

- **One check everywhere.** The admin's `canView`/`canEdit`, a page guard, a session
  `scope`, and a guarded RPC all delegate to the same `can(user, permission)`.
- **Resolution rides on vike-auth.** `resolve.js` runs in vike-auth's `resolveUser`
  seam right after the user is resolved, so the check is **sync** on every page.
- **Seed-from-registry.** `seedRbac()` derives the roles/permissions/grants from the
  composed `permissions` registry — no hand-written seed list.
- **Named-guard binding.** By default rbac enriches the default subject (`pageContext.user`).
  Set `rbacGuard: 'admin'` to bind it to a [named guard](../vike-auth) instead: `role_user.user_id`
  FKs to that guard's subject table and the resolver enriches `pageContext.guards.admin.user`. The
  runtime/RPC half follows the same guard via the `VIKE_RBAC_GUARD` env (the `storageGuard` /
  `VIKE_STORAGE_GUARD` config/env split). Unset = the default subject, byte-for-byte. (One binding
  per rbac install; RBAC over more than one guard at once is a later multi-instance step.)
- **Org-scoped roles.** With `orgRoleSource: 'memberships'`, per-organization role
  grants are read from [vike-teams](../vike-teams); `can(user, perm, { org })` checks
  global ∪ org access. The page enricher records the configured `orgRoleSource`, and the
  RPC seam reads org grants from the same source, so `requirePermission('x', { org })`
  authorizes identically on a page and over Telefunc. (A server can also call
  `setOrgRoleSource('memberships')` at startup for an RPC that precedes any page render.)
- **Telefunc seam.** `requirePermission()` reads the signed-in, role-enriched user off
  the Telefunc context, so a server function is authorized by exactly what `canView`
  enforces.
