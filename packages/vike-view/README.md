# vike-view

Schema-driven views (list / record / form) for any framework. The composed schema is the
source of truth; a thin `defineView` config refines it; per-framework renderers draw it.

This package is the **schema layer over [`vike-elements`](../vike-elements)**: it derives a
plain, serializable view-model from the merged schema and registers `list`/`record`/`form`
blocks into vike-elements' registry, so a page can compose them. vike-elements owns the
generic substrate (the block IR, the `definePage` composer, the registry + `defineElement`
seam, the primitive elements); vike-view adds the data-driven blocks on top. No React, no
Vue, no Vike. "Declare intent, derive implementation."

## The three views, all derived from schema

| View | Derived from | Gives you |
|---|---|---|
| **List** | table + field types | columns, sort/search flags, formatting |
| **Record** | one row + relations | read-only detail display, FK-aware cells |
| **Form** | field types + validation | inputs, relation selects, required-ness |

## The view is a UI schema

A page is a **composition of blocks** (the UI/UX schema — see vike-elements). `defineView` is
vike-view's schema-flavored entry to the `definePage` composer: importing it registers the
schema-derived blocks (`list`/`record`/`form`), so they resolve out of the box alongside the
bespoke ones (`stat`/`markdown`/`custom`) and the fluent elements. The genuine long tail ejects
to a real component / an AI-generated page rather than growing more config knobs.

```js
import { defineView, crudBlocks } from 'vike-view'

// A page composed of blocks; list/record/form derive from the schema.
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

`resolveView(view, tables)` (which is vike-elements' `resolvePage` re-exported — importing it
from vike-view is what guarantees the schema blocks are registered) turns those descriptors
into serializable view-models a renderer draws: a schema-derived block fills its
`columns`/`fields` from the schema (through the same crud engine), a bespoke block echoes its
props. The registry is open — an app or extension adds a block with
`registerBlock('gauge', { resolve })`, so a new block type ships with the component that
renders it. The genuine long tail drops to `block: 'custom'` or an AI-ejected
page; there is deliberately no layout/expression DSL.

`crud({ table })` (below) is the schema-derived CRUD preset; `crudBlocks({ table })` expands
it into the three `list`/`record`/`form` block descriptors for a page.

## Elements — fluent leaf blocks

For the non-schema bits of a page, author leaf blocks fluently with the element builders from
vike-elements (re-exported here for convenience). Same pattern as `column()`/`field()`, one
level up — a lowercase factory that `.build()`s to a plain block descriptor:

```js
import { defineView } from 'vike-view'
import { heading, text, badge, divider, link } from 'vike-elements'

defineView({
  route: '/posts/@id',
  sections: [
    heading('Post').level(2),
    { block: 'record', table: 'posts' },
    badge('Draft').tone('warning'),
    divider(),
    link('Back to posts').to('/posts'),
  ],
})
```

Display-only today (`text` / `heading` / `badge` / `divider` / `link`). Interactivity — a
button that *does* something — is a separate axis: behavior can't be an inline closure in
serializable config, so it's being scoped on its own (see the vike-actions investigation).
`link().to(path)` covers declarative navigation in the meantime.

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
