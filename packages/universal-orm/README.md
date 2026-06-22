# @universal-orm/core

The **runtime** half of the data layer: how an extension reads and writes its data
**without importing an ORM**. It is the runtime twin of
[`@vike-data/universal-schema`](../universal-schema) (the shape half) and the
missing member of the `universal-*` family:

| Universal layer | One ... | runs on any ... |
|---|---|---|
| `universal-middleware` | request handler | server (Hono / Express / CF) |
| `universal-schema` | schema (DDL — the shape) | ORM (Prisma / Drizzle / native) |
| **`universal-orm`** | repository call (DML — the data) | ORM |

An extension declares its tables once with the schema DSL, then talks to a neutral
repository. A per-ORM **adapter** executes the calls against the app's database.
`vike-stripe` just does `db.subscriptions.upsert(...)` — no ORM import.

## The surface is narrow on purpose

```js
db.users.insert(row)                       // -> inserted row
db.users.find(filter)                      // -> matching rows (array)
db.users.findOne(filter)                   // -> first match | null
db.users.upsert(row, { onConflict })       // -> upserted row
db.users.update(filter, patch)             // -> updated rows (array)
db.users.delete(filter)                    // -> number of rows deleted
```

Filters are simple **equality** or **`in`** conditions — nothing more:

```js
db.users.find({ active: true })            // equality
db.users.find({ id: { in: ['u1', 'u2'] } })// membership
db.users.find()                            // all rows
```

Joins, aggregates, ranges, raw SQL — deliberately **out of scope**. Drop to the
underlying ORM for those, the same escape hatch as DB-specific column types. This
is not a query language (that is Kysely's job); it is the 90%-case repository.

## Using it

```js
import { createRepository } from '@universal-orm/core'
import { defineSchema, mergeSchemas } from '@vike-data/universal-schema'

const { tables } = mergeSchemas([
  defineSchema('users', (t) => {
    t.uuid('id').primary()
    t.string('email').unique()
    t.boolean('active')
  }),
])

const db = createRepository({ tables }, adapter) // adapter: see below
await db.users.upsert({ id: 'u1', email: 'a@b.com', active: true }, { onConflict: 'email' })
```

Tables and their columns come from the **merged schema** (the output of
`mergeSchemas`), the same single source the ORM artifacts are generated from. A
typo'd column or an unknown table is a clear error, not a silent no-op.

## The adapter contract

The app installs **one** adapter and hands it the connection; extensions never
import an ORM (same shape as `@universal-middleware/*`). An adapter implements five
operations, each taking the table **name** first:

```js
const adapter = {
  insert(table, row),                  // -> inserted row
  find(table, filter),                 // -> rows[]
  upsert(table, row, { onConflict }),  // -> upserted row (onConflict: column names)
  update(table, filter, patch),        // -> updated rows[]
  delete(table, filter),               // -> number deleted
}
```

In-process adapters can reuse the shared filter matcher so every adapter agrees on
what a filter means; SQL adapters translate the same shape into a `WHERE` clause:

```js
import { matchesFilter } from '@universal-orm/core'
matchesFilter(row, { active: true })
```

The shippable adapters — an in-memory one for tests/demos and
`@universal-orm/drizzle` for real — are tracked in
[#46](https://github.com/suliemandev/vike-data/issues/46). No transactions yet: the
common operation is a single (atomic) upsert.

> **Zero Vike, zero ORM imports.** Usable standalone by any framework or ORM.
