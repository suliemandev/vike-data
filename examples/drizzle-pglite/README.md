# examples/drizzle-pglite

The **real persistent-database** twin of [`examples/react`](../react). Same admin + auth + rbac
app, but running on **`vike-drizzle` + an embedded Postgres (pglite)** instead of the in-memory
adapter. It exists to show the one thing the in-memory examples can't: how a real app handles a
schema, migrations, and seeding.

## Why a separate example

The in-memory examples register `createMemoryAdapter()` and hand-insert fixed-id rows on every
boot. That is fine there, because the in-memory store starts empty on every restart. But it
models a pattern that **breaks the moment you point it at a real database**: the same boot hook
re-runs each start, and the fixed ids duplicate or crash on a primary-key conflict. This example
is the correct path.

## What actually differs from examples/react

The app code (`+config.js`, `+adminResources.js`, the pages) is wired the same way. Only the data
layer changes:

1. **`pages/+onCreateGlobalContext.js`** opens the persistent pglite connection, runs migrations,
   and registers the Drizzle adapter via `vike-drizzle` -- instead of `setAdapter(createMemoryAdapter())`.
2. **`vite.config.js`** adds the `vikeSchema()` plugin, which generates `drizzle/schema.generated.ts`
   from every installed extension's tables (vike-auth's `users`/`sessions`/`login_tokens`,
   vike-rbac's `roles`/`permissions`/`role_user`/`permission_role`). The memory adapter is
   schema-less, so `examples/react` never needs this.
3. **`db/`** holds the migration + seed scripts.

## The three seeding tiers

The rule: **anything that runs on every boot must be idempotent.** Raw `insert` with fixed ids
only belongs where the store is fresh each time (the memory demo) or in a one-shot script.

| Tier | What | Where | When |
|---|---|---|---|
| 1. Tables | schema -> SQL migrations | `drizzle/migrations/` (committed), applied by `db/migrate.js` | a deploy step (also run on boot, idempotent) |
| 2. Reference data | roles / permissions / grants | `seedRbac()` (idempotent) | safe on every boot |
| 3. Business rows | the demo users | `db/seed.js` (idempotent find-or-create) | `pnpm db:seed` or real signups -- **never on boot** |

## Run it

```bash
pnpm install            # from the repo root
cd examples/drizzle-pglite

pnpm setup              # migrate + seed (run once, with the dev server stopped)
pnpm dev                # http://localhost:4200
```

Then sign in at `/login` as **ada@example.com** (admin: can view + edit Users) or
**alan@example.com** (member: denied). The magic-link URL is printed to the page and the dev
console -- no mail provider needed. Visit `/admin`, then **restart the server**: the rows are
still there. That persistence is the whole point.

> You can also skip `pnpm setup` and just `pnpm dev`: the boot hook applies migrations and seeds
> the RBAC reference data (tiers 1 + 2) for you, so the app works immediately -- you just won't
> have the sample users until you run `pnpm db:seed` (tier 3), or sign up to create your own.

## Scripts

| Script | What |
|---|---|
| `pnpm dev` | Run the app (also regenerates the schema + applies migrations on boot). |
| `pnpm db:generate` | Re-derive SQL migrations from the generated schema (after a schema change). |
| `pnpm db:migrate` | Apply migrations to the database (idempotent). |
| `pnpm db:seed` | Seed reference data + sample users (idempotent). |
| `pnpm setup` | `db:migrate` then `db:seed`. |
| `pnpm db:reset` | Delete the `.pgdata/` directory for a clean slate. |

## Notes

- **pglite is single-process.** Only one process can hold `.pgdata/` at a time, so stop the dev
  server before running `pnpm db:seed`/`db:migrate`. A server-backed Postgres has no such limit:
  swap the two lines in `db/connection.js` for `drizzle(pool)` over `node-postgres` and nothing
  else changes.
- **`drizzle/schema.generated.ts` is generated**, not hand-written -- it carries a "do not edit"
  header and is rewritten on every dev/build. After changing which extensions are installed, run
  `pnpm db:generate` to refresh the migrations.
