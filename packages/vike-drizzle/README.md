# vike-drizzle

The **Drizzle binding** for vike-data: register your Drizzle connection once and it
becomes the [universal-orm](../universal-orm) adapter, so every extension
(`vike-stripe`, `vike-auth`, ...) writes to your real database through the neutral
repository, with no manual `setAdapter` wiring.

## Usage

The app owns its connection, so it registers it in Vike's
[`onCreateGlobalContext`](https://vike.dev/onCreateGlobalContext) hook — the
once-per-server runtime point:

```js
// pages/+onCreateGlobalContext.js
import { registerDrizzle } from 'vike-drizzle'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../drizzle/schema.generated.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default function onCreateGlobalContext() {
  registerDrizzle(drizzle(pool), schema)
}
```

That's it — `vike-stripe` and friends now write to Postgres. `registerDrizzle` is
idempotent (the first registration wins), so duplicate hook evaluation can't fork the
adapter. `schema` may be the `import * as schema` namespace (its table values are
used) or an array of Drizzle tables.

## Why a runtime hook, not `extends: [...]`

A live database connection can't travel through Vike's config (it is serialized and
pointer-based), and Vike's `extends` only accepts module pointer-imports, not a
constructed object. The connection is the app's, created at runtime, so the app owns
the one-line hook. `vike-drizzle` is the thin seam between it and
`@universal-orm/core`'s [adapter registry](../universal-orm#the-adapter-registry-one-adapter-every-extension).

## Without it

If no adapter is registered, extensions fall back to the in-process memory adapter
(zero-config dev/demo/proof). Installing `vike-drizzle` is the switch from memory to a
real database — nothing else in the extensions changes.

## API

- **`registerDrizzle(db, schema, { override = false })`** — register a Drizzle `db`
  (e.g. `drizzle(pool)`) + generated `schema` as the runtime adapter. Returns the
  adapter. Idempotent unless `override` is set.
- **`createDrizzleAdapter`** — re-exported from `@universal-orm/drizzle` for direct use.

The demo app (`app/pages/+onCreateGlobalContext.js`) wires this with **PGlite**
(in-process Postgres, zero setup) under `VIKE_DATA_ORM=drizzle`.
