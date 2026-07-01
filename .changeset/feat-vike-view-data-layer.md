---
'vike-view': minor
---

Add the server-side data layer (`vike-view/data`) — the complement to `resolveView` that turns a rendered structure into a working CRUD screen (#377):

- **`hydrateView(view, { tables, db, scope, search })`** fills each data-driven block: a `list` block gets its paged rows + FK labels (a FK cell shows the referenced row's title, not the raw key) + paging state, projected to the visible columns (no hidden-column leak, #228); a `record` block (with an `id`) gets its one row. Runs on any universal-orm adapter (memory for demo/tests, a real DB in production).
- **`createRow` / `updateRow` / `deleteRow`** are the write path: coerce a submitted form to a row, fill a client-generatable primary key, and enforce **row scoping (#104)** — a caller-supplied `scope(table, ctx) -> filter` bounds every read and is forced onto writes, so a scoped user only ever sees / edits / creates their own rows (a forged owner field is overwritten; an id-guess for another owner's row matches nothing). Scope stays a request-time function, so a predicate never has to serialize to the client.

Verified end to end: a `defineView` over a seeded table hydrates and server-renders to HTML with the real rows and FK labels; the write path round-trips and enforces ownership on the memory adapter.

**Page generation** (`vike-view/react/config`): an app installs the Vike extension and turns its views into real pages with `viewPages(views)` — each `view.route` becomes a page whose GET hydrates + renders the view and whose POST writes through the scoped data hook (a plain SSR form post, no separate endpoint), modeled on vike-admin's data hooks:

```js
import vikeView from 'vike-view/react/config'
import { defineView, crudBlocks, viewPages } from 'vike-view/react'
const views = [defineView({ route: '/posts', sections: crudBlocks({ table: 'posts' }) })]
export default { extends: [vikeView], views, pages: viewPages(views) }
```

`views` is a server-only cumulative config point, so a view's `scope` function survives to the data hook instead of being serialized away. The page-gen logic (`viewPages` / `viewForRoute` / `formFieldsFor`) is unit-tested; the generic `ViewPage` + `viewData` Vike hook are transpile-checked and modeled on the proven admin pattern (full Vike-runtime verification via an example app is the remaining step).
