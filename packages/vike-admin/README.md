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

## Server-env config

`adminResources` is **server** config (not client): the admin is SSR + form POSTs, so a resource's functions (`canView` / `canEdit`, builders) stay server-side and nothing serializes to the client. Each data hook derives a plain, serializable view-model.

## Packaging

`vike-admin` core (framework-agnostic: the seam, schema introspection, the universal-orm reads) + `vike-admin/react` (the UI). Same core/UI split as every vike-data extension.

## Known limits (MVP)

- universal-orm `find` returns **all** rows (filters are equality / `in`; no limit/offset/order). Fine for a demo; list **pagination** is a small universal-orm follow-up, not a silent cap.
- list + create only. Detail / edit / delete, FK fields as selects, per-type fields, and role auth beyond signed-in are follow-ups (see issue #53).
