---
'vike-admin': minor
---

vike-admin: an agent API for the admin's data as JSON. `GET /admin.json` returns the resources the caller may view; `GET /admin/<table>.json` returns a resource list, accepting the same narrow universal-orm query as the UI via `?query=` (URL-encoded JSON: `filter` / `orderBy` / `limit` / `offset`, equality + `in` only, validated against the resource's columns; an unknown column or operator is a 400).

It is not a second surface with its own auth: the `.json` endpoint RENDERS the matching admin page through Vike, so it runs the exact same pipeline as the browser UI (vike-auth resolves the user, vike-rbac enriches roles/permissions, the page guard runs, and `listData` applies the same `scope(user)` AND-merge + `canView` allow-list), then returns that data as JSON. The caller's `?query=` can only ever narrow within the row scope, never widen past it; rows are projected to the resource's visible columns so a hidden column (a password hash) never leaks. The API inherits the UI's security model by construction.

MVP is read-only and reuses the session cookie (anonymous → 401, denied/unknown resource → 404, bad query → 400). Write ops and API-token auth for headless agents are follow-ups.
