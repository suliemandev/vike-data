# vike-data (experiment)

> **Status: early experiment / spike.** Not a published package. The APIs here are
> throwaway and the per-ORM compilers emit representative output only (they don't
> run against real databases yet). This repo exists to explore a design, not to be
> installed.

A proof-of-concept exploring what a **data-layer extension for [Vike](https://vike.dev)**
could look like. It probes two questions:

1. **Inter-extension registration** - can one extension expose a contribution
   point that other extensions plug into, using Vike's own config system?
2. **ORM-agnostic schema** - can an extension define a schema *once* and have it
   work regardless of the ORM the user picked (Prisma, Drizzle, or a native engine)?

It's a pnpm workspace: a `vike-data` extension, two example feature extensions
that contribute to it, and an example app that installs them.

```bash
pnpm install
cd app && pnpm dev            # http://localhost:4000
VIKE_DATA_ORM=prisma pnpm dev     # switch the target ORM (prisma|drizzle|native)
```

---

## Spike 1 - inter-extension registration

**Question:** Can one Vike extension expose a contribution point that *other*
extensions plug into, using Vike's own config system (no side-channel global)?
This is the mechanism a data-layer extension needs so an auth/billing extension
can ship its own migrations + seeds.

**Answer: yes.** Vike's **cumulative custom config** does exactly this.

### How it works

`vike-data` defines a custom config `migrations` with `cumulative: true`:

```js
// packages/vike-data/+config.js
export default {
  name: 'vike-data',
  meta: { migrations: { env: { config: true, server: true }, cumulative: true } },
  migrations: ['000_create_migrations_table'], // vike-data's own contribution
}
```

Every other source just sets `migrations: [...]`; Vike accumulates them all.
The consumer reads the merged list via `pageContext.config.migrations`
(see `app/pages/+onRenderHtml.js`).

### Layout

- `packages/vike-data` - the data layer: defines + seeds the `migrations` point,
  and ships the schema DSL + compilers at `vike-data/schema` (splittable into a
  standalone `vike-schema` package later).
- `packages/example-auth` - a feature extension contributing 2 migrations + 2 tables.
- `packages/example-billing` - a feature extension contributing 1 migration + 1
  table (with a deliberately clashing `001_` prefix).
- `app` - installs all three via `extends` and adds its own migration.

Renders: **5 migrations collected from 4 sources.**

### Findings (what Vike does and does NOT do)

1. **Accumulation works across independent extensions** - cumulative config is
   the right primitive for inter-extension contribution.
2. **One entry per source, no flattening** - each source's value is kept as-is,
   so contributing arrays yields an array-of-arrays. The consumer must flatten.
3. **Order is by config specificity, not dependency or name** - the app's `100_`
   came before the foundational `000_`. The data layer must sort itself (here, by
   numeric prefix).
4. **No conflict detection** - auth's `001_` and billing's `001_` coexist
   silently. Dedupe/collision handling is the data layer's job.
5. **A node_modules extension cannot `extends` another from raw source** - Vike
   runs its import->pointer transform only on the app's own `+config` files, not
   on extension configs loaded from `node_modules` (those are expected to be
   pre-built by Vike's build tooling). So "installing auth auto-pulls vike-data"
   needs Vike's build step, or the app wires both.
6. **Hooks must be separate `+hook.js` files**, not inline functions in a config
   (config values get serialized).

---

## Spike 2 - one schema definition, any ORM

**Question:** what's a minimal way for an extension to define a schema regardless
of which ORM the user picked?

**Approach:** a neutral, *declarative* schema IR + per-adapter compilers.

- `vike-data/schema` - `defineSchema('users', t => ...)` returns plain-data IR;
  `toPrisma` / `toDrizzle` / `toNative` compile that one IR to each ORM. (Lives
  inside `vike-data` for now; can be split into a standalone `vike-schema` later.)
- Each extension authors its tables **once** (`packages/example-*/schema.js`)
  with no ORM imported.
- The app picks an ORM via `VIKE_DATA_ORM`; the page renders the single definition
  compiled to all three side by side, marking the selected one as "gets applied".

Declarative is the key choice: Prisma/Drizzle diff desired-state into a
migration, and a native engine generates one, so the shared format stays
*state*, not imperative steps.

### What's proven

One `defineSchema('users', ...)` becomes, with zero per-ORM authoring:
- a Prisma `model Users { ... @@map("users") }`
- a Drizzle `pgTable('users', { ... })`
- a native `Schema.create('users', t => ...)` migration

### v1 scope / deferred (the interesting hard parts)

- Types: uuid/string/text/integer/boolean/timestamp + nullable/unique/primary/default. Enough to prove it.
- **Relations / foreign keys** - deferred; the genuinely hard bit.
- **Type escape hatches** - DB-specific types (pg arrays, enums, JSON) need a per-adapter `.raw()` override so the neutral layer isn't lowest-common-denominator.
- **Declarative -> migration reconciliation** - how a native engine turns desired-state into an *ordered* migration (ties back to spike 1's ordering finding).
- Compilers emit representative artifacts; they don't run against real DBs yet.

---

## Open design questions

- The ergonomic side of finding #5: what's a clean way for an extension to declare
  "I depend on vike-data and contribute to it" so that installing the extension
  alone wires everything up, without the app having to `extends` vike-data too.
- How far the neutral schema IR should go before an escape hatch is the better
  answer (relations, DB-specific types).
