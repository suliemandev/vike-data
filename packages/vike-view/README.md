# vike-view

Schema-driven views (list / record / form) for any framework. The composed schema is the
source of truth; a thin `defineView` config refines it; per-framework renderers draw it.

This package is the **framework-agnostic core**: no React, no Vue, no Vike. It derives a
plain, serializable view-model from the merged schema, so any renderer (and the `vike-admin`
preset) can consume the same derivation. "Declare intent, derive implementation."

## The three views, all derived from schema

| View | Derived from | Gives you |
|---|---|---|
| **List** | table + field types | columns, sort/search flags, formatting |
| **Record** | one row + relations | read-only detail display, FK-aware cells |
| **Form** | field types + validation | inputs, relation selects, required-ness |

## The view is a UI schema

The top-level primitive is `defineView` — a **page as a composition of blocks** (the UI/UX
schema), where a block may be schema-derived (`list` / `record` / `form` of a table) or
bespoke (`stat` / `markdown` / `chart` / `custom`). Blocks live in an open registry, and the
genuine long tail ejects to a real component / an AI-generated page rather than growing more
config knobs.

```js
import { defineView, crudBlocks, registerBlock } from 'vike-view'

// The general primitive (block IR): any page, composed of blocks.
defineView({
  route: '/dashboard',
  sections: [
    { block: 'stat',     title: 'Revenue', source: 'orders.sum(total)' },
    { block: 'list',     table: 'orders' },        // schema-derived
    { block: 'markdown', source: '# Welcome' },
    { block: 'custom',   component: 'MyChart' },    // your own component
    ...crudBlocks({ table: 'posts' }),              // the crud preset: list + record + form
  ],
})
```

`resolveView(view, tables)` turns those descriptors into serializable view-models a renderer
draws: a schema-derived block fills its `columns`/`fields` from the schema (through the same
crud engine), a bespoke block echoes its props. The registry is open — an app or extension
adds a block with `registerBlock('gauge', { resolve })`, so a new block type ships with the
component that renders it. The genuine long tail drops to `block: 'custom'` or an AI-ejected
page; there is deliberately no layout/expression DSL.

`crud({ table })` (below) is the schema-derived CRUD preset; `crudBlocks({ table })` expands
it into the three `list`/`record`/`form` block descriptors for a page.

## `crud` — the built-in CRUD preset

```js
import { crud, column, display, field } from 'vike-view'

crud({
  table: 'posts',                                    // a table in the composed schema
  list:   [column('title').sortable(), column('created_at').format('since')],
  record: [display('title'), display('body'), display('author_id')],
  form:   [field('title').required(), field('status').type('select')],
  canView: (user) => !!user,
  canEdit: (user) => user?.role === 'admin',
  scope:  (user) => (user?.role === 'admin' ? null : { user_id: user.id }), // row scoping (#104)
})
```

Everything is optional except `table` — omit `list`/`record`/`form` and each is derived
from the schema (every non-hidden column). `id`, `*_hash`, and the `created_at`/`updated_at`
timestamps are hidden by convention.

## Deriving the view-model

```js
import { resolveViewTables, tableNamed, viewColumns, viewRecord, viewFields, buildDb } from 'vike-view'

const tables = resolveViewTables(config)          // merge the cumulative `schemas` point
const table = tableNamed(tables, 'posts')
const columns = viewColumns(view, table)          // list columns
const detail  = viewRecord(view, table)           // read-only record fields (FK-aware)
const fields  = viewFields(view, table)           // form fields (required, selects, options)
const db = buildDb(tables)                         // a universal-orm repository on the app adapter
```

Field widgets follow the column's semantic hint (`.as('email')`, `.as('enum')`, `.as('date')`)
so one schema declaration drives a rich control, with the storage type kept as the coercion
token. A foreign key becomes a select whose options a data hook fills from the referenced table.

`projectRow` is the shared allow-list that keeps hidden columns from leaving the server;
`parseListQuery` validates a `?query=` (filter / orderBy / limit / offset) against a view's
columns before it reaches the database.

## Relationship to vike-admin

`vike-admin` is a **preset over vike-view**: it wires these derivations to a whole-DB
`/admin/*` panel with pages, guards, and a JSON API. Reach for vike-view directly to render
a single table's screens at your own routes.
