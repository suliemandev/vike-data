# @vike-data/vike-schema

The **Vike binding** for the data layer: the cumulative `schemas` config point where
every extension contributes its tables, plus the codegen Vite plugin that merges them
and **derives** the per-ORM artifacts. The runtime twin is
[universal-orm](../universal-orm); the framework-agnostic schema core it wraps is
[universal-schema](../universal-schema).

## Usage

Extensions self-install this as their base, so an app rarely wires it directly. To
contribute tables from an extension:

```js
// some-extension/config.js
import { defineSchema } from '@vike-data/vike-schema/schema'

export default {
  extends: ['import:@vike-data/vike-schema/config:default'], // pull in the `schemas` point
  schemas: [defineSchema('widgets', (t) => ({ id: t.id(), name: t.text() }))],
}
```

Add the codegen plugin to the app's Vite config so the artifacts stay in sync on dev
and build:

```js
// vite.config.js
import vike from 'vike/plugin'
import vikeSchema from '@vike-data/vike-schema/plugin'

export default { plugins: [vike(), vikeSchema()] }
```

Pick the target ORM with `VIKE_DATA_ORM=drizzle|prisma|rudder` (or the plugin's `orm`
option). Run `VIKE_DATA_GEN=check vite build` for the CI drift gate (fail if the
committed artifacts are stale).

## Exports

| Subpath | What |
|---|---|
| `./config` | The Vike config that declares the cumulative `schemas` contribution point. |
| `./schema` | Re-exports the universal-schema DSL (`defineSchema` / `extendSchema` + merge/derive helpers), so extensions need only this one import. |
| `./plugin` | The `vikeSchema()` Vite plugin — reads the resolved `schemas` graph via `getVikeConfig()`, merges + orders by FK dependency, and writes the per-ORM files. |

## How it works

Schema is the single source of truth. The plugin reads the merged `schemas` from every
installed extension (no hardcoded contribution list), validates foreign keys *across*
extensions, and compiles the result to Prisma, Drizzle, or the Rudder engine — the same
schema, three targets. Migrations and per-ORM files are generated, never hand-authored.
