# vike-data (experiment)

> **Status: early experiment / spike.** Not a published package. The APIs here are
> throwaway and the per-ORM compilers emit representative output only (they don't
> run against real databases yet). This repo exists to explore a design, not to be
> installed.

A proof-of-concept for a **data-layer extension for [Vike](https://vike.dev)**.
The model in one line:

> **Extensions declare schema once. vike-schema collects it through one Vike config
> point, merges it, and derives migrations + per-ORM artifacts from the result.**

Schema is the single source of truth. Migrations are an output, not something you
hand-author. The same schema targets Prisma, Drizzle, or a native engine.

The code is split into two packages along a clean seam:

- **`@vike-data/universal-schema`** - the framework-agnostic core: the neutral
  schema IR + DSL (`defineSchema`/`extendSchema`), the merge/derive logic, and the
  per-ORM compilers. Zero Vike imports; usable standalone by any framework or ORM.
- **`@vike-data/vike-schema`** - the thin Vike binding: contributes the `schemas`
  cumulative config point and re-exports the core at `@vike-data/vike-schema/schema`.

```bash
pnpm install
cd app && pnpm dev            # http://localhost:4000 (defaults to drizzle)
pnpm dev:prisma               # or dev:drizzle / dev:native to pick the target ORM

pnpm gen:prisma               # WRITE the artifacts to disk (or gen:drizzle / gen:native)
```

(`dev:prisma` / `gen:prisma` etc. just set the `VIKE_DATA_ORM` env var for you. The
`dev` server only *renders* the compiled schema; `gen` is what writes files.)

## File generation

`pnpm gen:<orm>` (the Prisma-style explicit command, `app/generate.mjs`) writes the
derived artifacts to their conventional paths, each with a `// GENERATED ... do not
edit by hand` header (the Prisma/Cloudflare precedent). Division of labour follows
each ORM's own model:

- **Prisma** -> `prisma/schema.generated.prisma`, **Drizzle** -> `drizzle/schema.generated.ts`:
  ONE declarative schema file (desired state). Their own tooling (`prisma migrate` /
  `drizzle-kit`) derives the migrations. The 3rd-party column add is folded in.
- **Native** -> `database/migrations/NNN_*.generated.ts`: the engine we own, so WE emit
  the ordered migration ledger. The cross-extension add becomes its OWN
  `alter_users_add_current_organization_id` migration, separate from `create_users` -
  mirroring how the columns were actually contributed.

**Suffix convention.** Every artifact carries both the `// GENERATED ... don't edit`
header AND a `.generated.` filename suffix, matching the Vike-wide convention (cf.
Vike's own `vike.generated.d.ts`, [vikejs/vike#698](https://github.com/vikejs/vike/issues/698)):
the header is the portable signal, the suffix makes generated files obvious at a
glance. Since `schema.generated.prisma` isn't Prisma's default path, point Prisma at
it with `"prisma": { "schema": "prisma/schema.generated.prisma" }` (Drizzle's path is
set in `drizzle.config.ts` anyway).

These files are **committed**, not gitignored: diffs stay visible and CI is
reproducible, while the header keeps them honestly marked as output. Only an ORM's
generated *client* (e.g. Prisma Client) is ignored. Generation is idempotent -
re-running produces byte-identical files. Schema is the source of truth; declarations
are authored, the ORM schema is generated output (the usual model, inverted).

## How it flows

1. **`vike-schema` defines a contribution point** - a custom `cumulative` Vike
   config named `schemas` (`packages/vike-schema/+config.js`).
2. **Each extension contributes declarative schema** - `defineSchema('users', t => ...)`
   to create a table, or `extendSchema('users', t => ...)` to add columns to a
   table another extension created. No ORM imported (`packages/vike-auth/+config.js`,
   `packages/vike-teams/+config.js`).
3. **vike-schema merges everything** and **derives** the migration list, then
   **compiles** each merged table to the selected ORM (`app/pages/+onRenderHtml.js`).

The page renders: the derived migrations, each merged table (with columns added
by other extensions flagged), and each table compiled to Prisma + Drizzle +
native side by side.

## Can a 3rd-party extension touch another's table?

- **Add columns: yes.** `vike-teams` adds `current_organization_id` to the `users`
  table that `vike-auth` created. It lands in the merged schema and compiles
  into every ORM. This is a first-class, supported pattern.
- **Edit an existing column: detected, not silently applied.** If an `extendSchema`
  names a column that already exists, the merge step records a `column-edit`
  conflict rather than letting one extension quietly rewrite another's contract.
  Resolution is left to an explicit policy (out of scope for v1).

## Layout

- `packages/universal-schema` - the framework-agnostic core: the schema IR + DSL,
  the merge/derive logic, and the per-ORM compilers. No Vike imports.
- `packages/vike-schema` - the Vike binding: defines the `schemas` point, re-exports
  the core at `@vike-data/vike-schema/schema`, and dogfoods the point with its own
  `_migrations` table.
- `packages/vike-auth` - the keystone auth extension: owns `users` + `sessions`.
  The composition base (see below).
- `packages/vike-teams` - teams / multi-tenancy: creates `organizations` +
  `memberships`, references `users`, and adds a column to it. Self-installs vike-auth.
- `packages/example-auth` / `packages/example-billing` - the original minimal
  primitive demo (users/sessions + subscriptions + a column add). Kept for reference;
  the app now showcases the keystone instead.
- `app` - installs `vike-auth` + `vike-teams` (the chain self-installs `vike-schema`);
  defines nothing itself.

## Keystone: vike-auth + vike-teams (the Stem Vision)

The point of the data layer is **extensions that compose on each other's schema**.
`vike-auth` owns everything auth needs, starting with the `users` table. `vike-teams`
then builds on top without vike-auth knowing it exists:

- it **references** `users` by `user_id` (memberships) and `owner_id` (organizations);
- it **extends** `users` with `current_organization_id` via `extendSchema`;
- it **self-installs** vike-auth, which self-installs vike-schema, so the whole chain
  composes from one install: `vike-schema <- vike-auth <- vike-teams`.

That composition is the Stem Vision in miniature: a foundational extension owns a
table, and the higher-level extensions of a SaaS spine (teams, billing, audit logs)
layer on top of it additively. The same merged schema compiles to all three ORMs.
These are the framework-agnostic **core** tier; per-framework UI wrappers
(`vike-react-auth`, etc.) would layer on top reusing the exact same schema.

## Findings

**On the wiring (Vike's cumulative config as the contribution point):**

1. Cumulative config is the right primitive: independent extensions contribute and
   vike-schema sees them all, with no side-channel global.
2. It accumulates one entry per source (no flattening); the consumer flattens.
3. Order is config-specificity order, not dependency-aware. Migration ordering is
   the data layer's job.
4. No conflict detection at the Vike layer; dedupe/collision handling is the data
   layer's job (done here in `merge.js`).
5. An extension CAN self-install another from its own config using Vike's
   pre-serialized pointer-import string: `extends: ['import:@vike-data/vike-schema/config:default']`.
   (A bare `import x from '...'; extends: [x]` fails in a node_modules config
   because the import->pointer transform runs only on the app's own `+config`
   files, but the explicit string form needs no transform.) So installing auth
   alone pulls vike-schema in; the app no longer wires it.
6. When several extensions each self-install the same shared extension, *older* Vike
   included that extension's cumulative contributions once *per occurrence* (it
   didn't dedupe by extension identity for cumulative values). So vike-schema's own
   `_migrations` table arrived twice. The merge/derive layer dedupes it here.
   **Fixed upstream:** Vike accepted this as a bug and made extension installation
   idempotent ([vikejs/vike#3354](https://github.com/vikejs/vike/issues/3354), PR
   #3355 merged 2026-06-20). The host-side dedupe now stays as defense-in-depth and
   back-compat for older Vike.
7. Hooks must be separate `+hook.js` files, not inline functions in a config.

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

- ~~Whether a shared extension's cumulative contributions should be deduped by
  extension identity at the Vike layer (finding #6), or always left to the host to
  dedupe.~~ **Resolved upstream:** Vike made extension installation idempotent
  ([#3354](https://github.com/vikejs/vike/issues/3354), PR #3355 merged 2026-06-20).
- How far the neutral schema IR should go before an escape hatch is the better
  answer (relations, DB-specific types).
