# @universal-orm/rudder

The Rudder adapter for [`@universal-orm/core`](../universal-orm). It runs the neutral `insert` / `find` / `count` / `upsert` / `update` / `delete` calls against a [`@rudderjs/database`](https://www.npmjs.com/package/@rudderjs/database) `NativeAdapter` (Rudder's Laravel-style query builder). The app installs this one adapter and hands it the connection; extensions keep calling `db.<table>.<op>` and never import an ORM.

It is the runtime half of the Rudder vertical; the schema half is the `rudder` codegen target (which emits `@rudderjs/database` migrations).

## Install

```bash
pnpm add @universal-orm/rudder @rudderjs/database
# plus the driver you use: better-sqlite3 | postgres | mysql2
```

Most apps install it through [`vike-rudder`](../vike-rudder) (the one-line binding) rather than calling this directly.

## Usage

```js
import { NativeAdapter } from '@rudderjs/database/native'
import { createRudderAdapter } from '@universal-orm/rudder'
import { setAdapter } from '@universal-orm/core'

const native = await NativeAdapter.make({ driver: 'pg', url: process.env.DATABASE_URL })
setAdapter(createRudderAdapter(native))
```

## Why it is simpler than the Drizzle adapter

Rudder's raw query builder speaks DB column names (snake_case) **directly**: a row comes back as `{ password_hash: ... }`, not a Model's camelCase. universal-orm also speaks snake_case (the schema's names), so neutral keys pass straight through with no name translation, and the adapter needs only the connection, not the generated schema tables. Column validation already happens upstream in `createRepository`.

## Mapping to the Rudder query builder

| universal-orm op | Rudder query builder |
| --- | --- |
| `insert(table, row)` | `query(table).create(row)` (RETURNING the row) |
| `find(table, filter, opts)` | `query(table).where(...).orderBy(...).limit().offset().get()` |
| `count(table, filter)` | `query(table).where(...).count()` |
| `upsert(table, row, { onConflict })` | `query(table).upsert([row], onConflict, updateCols)`, then re-read by the conflict key |
| `update(table, filter, patch)` | capture matched PKs, `updateAll(patch)`, then re-read by those PKs |
| `delete(table, filter)` | `query(table).where(...).deleteAll()` (returns the count) |

Rudder's bulk writes (`updateAll` / `upsert`) return an affected-row count rather than the rows, so `update` / `upsert` do a follow-up read to honour the "return the row(s)" contract.

## Limitations

- A single-column primary key (default `id`, override with `createRudderAdapter(native, { primaryKey })`) is assumed for the `update` re-read. Composite-PK tables (the m2m join tables from #17) are a follow-up.
- No transactions (consistent with `@universal-orm/core`'s narrow surface; a single upsert is the common op).
- The narrow filter surface only: equality and `in`. Drop to `@rudderjs/database` directly for joins, ranges, OR, or raw SQL.
