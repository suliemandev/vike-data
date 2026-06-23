# vike-admin

A working admin panel on install. Add `vike-admin/react`, contribute a resource or two, and get `/admin/*` pages that **list and create** the rows of every table your extensions composed, gated by auth, rendered in your themed layout. It writes no ORM code.

This is "declare intent, derive implementation": the composed schema is the intent, the admin UI is **derived**, and a resource is the **refinement**.

## Install

```js
// +config.js
import admin from 'vike-admin/react'
import { usersResource } from './admin.js'

export default {
  extends: [admin /* , auth, themes, layouts, ... */],
  adminResources: [usersResource], // cumulative: composes with every extension's
}
```

Installing `vike-admin/react` brings the `/admin/*` pages (via `config.pages`) and opens the cumulative `adminResources` seam. There is no central `.resources([...])` registry: resources compose like `schemas` and `themes`.

## Define a resource

```js
import { defineResource, column, field } from 'vike-admin/define'

export const usersResource = defineResource({
  table: 'users',          // a table in the COMPOSED schema, not a Model class
  label: 'Users',
  list: [
    column('email').sortable().searchable(),
    column('created_at').format('since'),
  ],
  form: [
    field('email').type('email').required(),
    field('name'),         // type inferred from the schema
    // id / *_hash / timestamps auto-hidden by convention
  ],
  canView: (user) => !!user,
  canEdit: (user) => user?.role === 'admin',
  // Row scoping: bound a user to their OWN rows. Return a universal-orm filter, or a
  // falsy value for full access (encode the admin bypass here).
  scope: (user) => (user?.role === 'admin' ? null : { user_id: user.id }),
})
```

Minimal case: `defineResource({ table: 'subscriptions' })` derives every column and field from the schema. List/form refinements are optional.

### Row scoping

`scope(user)` returns a universal-orm filter that bounds **every** row op for that resource to the user's own rows: it is AND-merged into the list (and its count), the edit load, update and delete, and its scalar columns are forced onto inserts (so a user can neither create a row owned by someone else nor reassign ownership). Return a falsy value for full access, so the admin bypass lives in the function itself. A resource with no `scope` is unscoped. This is how `/admin` doubles as a self-service view: each user sees and edits only what they own.

## How it works

- **Pages** (`config.pages`): `/admin` (dashboard), `/admin/:table` (list), `/admin/:table/new` (create).
- **Schema introspection**: each page's `data` hook resolves the merged schema (`resolveSchemas` + `mergeSchemas`) and derives columns/fields a resource omits, auto-hiding `id` / `*_hash` / timestamps.
- **Data**: reads/writes go through [universal-orm](../universal-orm) (`db.<table>.find` / `.insert`) on whatever adapter the app registered (memory for dev, Drizzle for real). No ORM is imported.
- **Create POST**: the `/admin/:table/new` route owns its own POST. Vike hands the Web Request as `pageContext._reqWeb`, so the same route renders the form (GET) and inserts (POST), then redirects. No separate endpoint.
- **Auth**: a `guard` fences `/admin/*` to signed-in users (`pageContext.user`, from vike-auth); per-resource `canView` / `canEdit` refine access, and `scope` (above) bounds which rows a user sees and edits.

## Agent API (JSON)

The same admin, as machine-readable JSON, for an AI agent (or any HTTP client) acting on a user's behalf:

The same admin, as machine-readable JSON. Read:

- `GET /admin.json`: the resources the caller may view (the dashboard, as JSON).
- `GET /admin/<table>.json`: a resource list. Pass the narrow universal-orm query as `?query=`, a URL-encoded JSON object: `{ filter, orderBy, limit, offset }` (equality + `in` only, the same surface as the rest of universal-orm). Discrete `?page` / `?sort` / `?dir` also work.

Write (the row scope is forced, so a caller only ever writes their **own** rows):

- `POST /admin/<table>.json` with a JSON body: create a row. `201` + the created row.
- `PATCH /admin/<table>/<id>.json` with a JSON body: update a row by its primary key (partial, only the supplied fields). `200` + the updated row.
- `DELETE /admin/<table>/<id>.json`: delete a row by its primary key. `200` `{ "deleted": true }`.

```bash
curl --cookie "$SESSION" \
  "http://localhost:3000/admin/sessions.json?query=$(jq -rR @uri <<<'{"filter":{"active":true},"orderBy":"created_at","limit":20}')"

curl --cookie "$SESSION" -X POST -H 'Content-Type: application/json' \
  -d '{"token":"sess_abc"}' http://localhost:3000/admin/sessions.json
```

This is **not** a second surface with its own auth. Every `.json` endpoint renders the matching admin page through Vike, so it runs the **exact same pipeline** as the browser UI: vike-auth resolves the user, vike-rbac enriches roles/permissions, the guard runs, and the page's own data hook (`listData` for reads, `newData` / `editData` for writes) applies the same `scope(user)` AND-merge, `canView` / `canEdit` allow-list and ownership-forcing. It then returns that data as JSON instead of HTML. So:

- the caller's `?query=` can only ever **narrow within the row scope**, never widen past what the UI would show (scope is AND-merged last);
- a write forces the scope's owner columns onto inserts and keys updates / deletes on the primary key **and** the scope, so a caller can't create a row for someone else, reassign ownership, or touch another owner's row (an id-guess is a `404`);
- a non-viewable / non-editable / unknown resource **404**s, an anonymous caller **401**s, a bad `?query=` or JSON body is a **400** with a message: the same gates as the UI, no second authorization to get wrong;
- rows (read and written-back) are projected to the resource's **visible columns** (+ the primary key), so a hidden column (a password hash) never leaks and is never writable.

It reuses the session cookie; API-token auth for headless agents is a follow-up.

## Server-env config

`adminResources` is **server** config (not client): the admin is SSR + form POSTs, so a resource's functions (`canView` / `canEdit`, builders) stay server-side and nothing serializes to the client. Each data hook derives a plain, serializable view-model.

## Packaging

`vike-admin` core (framework-agnostic: the seam, schema introspection, the universal-orm reads) + `vike-admin/react` (the UI). Same core/UI split as every vike-data extension.

## Known limits (MVP)

- Queries are the narrow universal-orm surface: equality / `in` filters, single-column `orderBy`, `limit` / `offset` (no joins, ranges, OR, or raw SQL; drop to the ORM for those).
- The agent API is **read-only** (GET) and reuses the session cookie; write ops (POST) and API-token auth for headless agents are follow-ups.
- Per-type form fields, searchable/async FK selects, and role auth beyond `canView` / `canEdit` / `scope` are follow-ups (see issue #53).
