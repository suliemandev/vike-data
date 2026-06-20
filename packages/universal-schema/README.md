# @vike-data/universal-schema

> **Status: early experiment / spike.** The API is still throwaway and the per-ORM
> compilers emit representative output (they don't run against real databases yet).

The **framework-agnostic core** of the vike-data data layer. Zero Vike imports, zero
ORM imports - usable standalone by any framework or ORM.

You describe your tables **once** as plain, declarative data; this package merges
contributions from independent sources, derives the migration order, and compiles
the result to Prisma, Drizzle, or a native-engine artifact.

```bash
pnpm add @vike-data/universal-schema
```

## What's in the box

- **A neutral schema DSL** - `defineSchema` / `extendSchema`. No ORM imported; the
  result is plain data (an IR).
- **Merge + derive** - `mergeSchemas` folds creates and 3rd-party column adds into
  final tables (and flags column-edit conflicts); `deriveMigrations` produces the
  ordered migration names from the contributions.
- **Per-ORM compilers** - `toPrisma`, `toDrizzle`, `toNative` (and the `COMPILERS`
  map) turn one merged table into that ORM's schema.
- **File generation** - `generateArtifacts({ tables, fragments }, orm)` returns
  `[{ path, contents }]` ready to write to disk, each with a "generated, don't
  edit" header. Pure: it performs no filesystem access itself.

## Usage

```js
import {
  defineSchema,
  extendSchema,
  mergeSchemas,
  deriveMigrations,
  generateArtifacts,
} from '@vike-data/universal-schema'

// 1. Declare tables once (this is the source of truth).
const auth = defineSchema('users', (t) => {
  t.uuid('id').primary()
  t.string('email').unique()
  t.timestamps()
})

// 2. A different source can ADD columns to a table it didn't create.
const billing = extendSchema('users', (t) => {
  t.string('stripe_customer_id').nullable()
})

// 3. Merge + derive.
const fragments = [auth, billing]
const { tables, conflicts } = mergeSchemas(fragments)
const migrations = deriveMigrations(fragments)

// 4. Generate committable artifacts for the ORM of your choice.
const files = generateArtifacts({ tables, fragments }, 'prisma')
//   -> [{ path: 'prisma/schema.prisma', contents: '// GENERATED ...' }]
```

## Design

- **Declarative (desired-state) is the right shape.** Prisma and Drizzle diff state,
  and a native engine generates an ordered migration from it, so authoring desired
  state and deriving everything downstream fits all three.
- **Migrations are an output, not authored by hand.** Schema is the single source of
  truth; the ORM schema becomes generated output (the usual model, inverted).
- **Vike-free on purpose.** The Vike binding lives in a separate package
  (`@vike-data/vike-schema`); this core is the part meant to be reusable anywhere.

## Scope / deferred (the interesting hard parts)

- Types: `uuid` / `string` / `text` / `integer` / `boolean` / `timestamp` plus
  `nullable` / `unique` / `primary` / `default`.
- **Relations / foreign keys** - deferred; the genuinely hard bit.
- **Type escape hatches** - DB-specific types (pg arrays, enums, JSON) want a
  per-adapter override so the neutral layer isn't lowest-common-denominator.
- **Declarative -> ordered migration reconciliation** - real diffing/ordering.
- **Column-edit policy** - conflicts are detected; resolution is unspecified.
- Compilers emit representative artifacts; they don't run against real DBs yet.
