---
'vike-rbac': patch
---

vike-rbac: org-scoped permission checks no longer always deny over Telefunc RPC.

`resolveRpcUser` resolved the caller's access by user id but never loaded org grants (it had no `pageContext` to read `orgRoleSource` from), so `user.orgPermissions` / `orgRoles` were always empty on the RPC path and any telefunction using `requirePermission('x', { org })` unconditionally aborted with `Forbidden` — page and RPC authorization diverged. The page enricher now records the configured `orgRoleSource` (`setOrgRoleSource`), and the RPC path resolves org grants from the same source via the new `resolveAccessForUser`, so an org-scoped guard authorizes identically on a page and over Telefunc. A flat app with no `orgRoleSource` is unchanged (global roles/permissions only). A server can also call `setOrgRoleSource(...)` at startup for an RPC that precedes any page render.
