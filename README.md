# vike-data (experiment)

> **Status: early experiment / spike.** Not a published package. The APIs here are
> throwaway and the per-ORM compilers emit representative output only (they don't
> run against real databases yet). This repo exists to explore a design, not to be
> installed.

A proof-of-concept for a **data-layer extension for [Vike](https://vike.dev)**.
The model in one line:

> **Extensions declare schema once. vike-data collects it through one Vike config
> point, merges it, and derives migrations + per-ORM artifacts from the result.**

Schema is the single source of truth. Migrations are an output, not something you
hand-author. The same schema targets Prisma, Drizzle, or a native engine.

```bash
pnpm install
cd app && pnpm dev            # http://localhost:4000 (defaults to drizzle)
pnpm dev:prisma               # or dev:drizzle / dev:native to pick the target ORM
```

(`dev:prisma` etc. just set the `VIKE_DATA_ORM` env var for you.)

## How it flows

1. **`vike-data` defines a contribution point** - a custom `cumulative` Vike
   config named `schemas` (`packages/vike-data/+config.js`).
2. **Each extension contributes declarative schema** - `defineSchema('users', t => ...)`
   to create a table, or `extendSchema('users', t => ...)` to add columns to a
   table another extension created. No ORM imported (`packages/example-*/+config.js`).
3. **vike-data merges everything** and **derives** the migration list, then
   **compiles** each merged table to the selected ORM (`app/pages/+onRenderHtml.js`).

The page renders: the derived migrations, each merged table (with columns added
by other extensions flagged), and each table compiled to Prisma + Drizzle +
native side by side.

## Can a 3rd-party extension touch another's table?

- **Add columns: yes.** `example-billing` adds `stripe_customer_id` to the `users`
  table that `example-auth` created. It lands in the merged schema and compiles
  into every ORM. This is a first-class, supported pattern.
- **Edit an existing column: detected, not silently applied.** If an `extendSchema`
  names a column that already exists, the merge step records a `column-edit`
  conflict rather than letting one extension quietly rewrite another's contract.
  Resolution is left to an explicit policy (out of scope for v1).

## Layout

- `packages/vike-data` - the extension: defines the `schemas` point, ships the
  schema DSL + compilers at `vike-data/schema` (splittable into a standalone
  `vike-schema` later), and dogfoods the point with its own `_migrations` table.
- `packages/example-auth` - creates `users` + `sessions`.
- `packages/example-billing` - creates `subscriptions`, and adds a column to `users`.
- `app` - installs all three via `extends`; defines nothing itself.

## Findings

**On the wiring (Vike's cumulative config as the contribution point):**

1. Cumulative config is the right primitive: independent extensions contribute and
   vike-data sees them all, with no side-channel global.
2. It accumulates one entry per source (no flattening); the consumer flattens.
3. Order is config-specificity order, not dependency-aware. Migration ordering is
   the data layer's job.
4. No conflict detection at the Vike layer; dedupe/collision handling is the data
   layer's job (done here in `merge.js`).
5. A node_modules extension can't `extends` another from raw source - Vike runs
   its import->pointer transform only on the app's own `+config` files. So
   "installing auth auto-pulls vike-data" needs Vike's build step, or the app
   wires both. (Today the app wires them.)
6. Hooks must be separate `+hook.js` files, not inline functions in a config.

**On the schema model:**

- A neutral, declarative IR + per-adapter compilers is enough to make one schema
  target Prisma / Drizzle / native. Declarative (desired-state) is the right
  shape, since Prisma/Drizzle diff state and a native engine generates a migration.

## v1 scope / deferred (the interesting hard parts)

- Types: uuid/string/text/integer/boolean/timestamp + nullable/unique/primary/default.
- **Relations / foreign keys** - deferred; the genuinely hard bit.
- **Type escape hatches** - DB-specific types (pg arrays, enums, JSON) need a
  per-adapter override so the neutral layer isn't lowest-common-denominator.
- **Declarative -> ordered migration reconciliation** - real diffing/ordering.
- **Column-edit policy** - conflicts are detected but resolution is unspecified.
- Compilers emit representative artifacts; they don't run against real DBs yet.

## Open design questions

- The ergonomic side of finding #5: a clean way for an extension to declare "I
  depend on vike-data and contribute to it" so installing it alone wires everything
  up, without the app having to `extends` vike-data too.
- How far the neutral schema IR should go before an escape hatch is the better
  answer (relations, DB-specific types).
