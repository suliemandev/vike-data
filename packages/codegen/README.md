# @vike-data/codegen (spike)

A spike of a **proposed Vike-core primitive**: one mechanism for any extension to
**derive committed files into the user's repo** (the "generated, don't edit"
pattern), instead of each one hand-rolling it.

## Why

Three parties already do this, each in their own way:

- **Vike itself** code-gens `vike.generated.d.ts` (route types — [vikejs/vike#698](https://github.com/vikejs/vike/issues/698)).
- **@vike-data** code-gens `schema.generated.prisma` / `drizzle/schema.generated.ts` / native migrations.
- Future extensions (typed env, API clients, typed routes) will want the same.

They all want the identical shape: collect generators from the resolved config
graph, run them, enforce one convention, then write or check. Vike already owns
the two inputs this needs (the resolved `+` config graph and the `.generated.`
convention), so the primitive belongs in core. #698 then becomes the first
internal consumer rather than a one-off.

## The contract

A generator is a plain object:

```js
{
  name: '@vike-data/vike-schema',          // identity: dedup + header provenance
  files(context) {                          // PURE: returns data, does not write
    return [{ path, comment, body }]        // path MUST contain `.generated.`
  }
}
```

- `files()` returns **header-less** logical files. Keeping it pure (return data,
  don't touch the fs) makes generators testable and serializable, and lets core
  own the cross-cutting parts.
- **Core owns the convention**: it stamps the "generated, don't edit" header
  (using each file's `comment` token), enforces the `.generated.` suffix, rejects
  path collisions between generators, and dedupes by generator identity.

## API

```js
import { materialize } from '@vike-data/codegen'

const report = await materialize({
  generators: [schemaGenerator, routesGenerator],
  context,                 // resolved from the Vike config graph
  mode: 'write',           // or 'check' for CI drift detection
})
```

- `mode: 'write'` persists files (`report.written`).
- `mode: 'check'` diffs against disk and reports `report.drift` (missing/stale);
  the driver exits non-zero so committed generated files stay honest in CI.

## Run the spike

From `app/`:

```bash
node generate.mjs            # write, VIKE_DATA_ORM=prisma|drizzle|native
node generate.mjs --check    # drift gate: exit 1 if any file is stale
```

Two generators are registered to prove the primitive is **generator-agnostic, not
schema-coupled**: the @vike-data schema generator, and a `vike:typed-routes`
generator that emits `routes.generated.ts` — a mini #698 showing Vike's own
internal codegen is just another consumer of this mechanism.

## Open questions for core (the discussion this spike feeds)

1. **Trigger** — build-time always; dev on graph change; plus an explicit
   `vike generate`? (This spike leans explicit, Prisma-style.)
2. **Drift policy** — is `--check` a core concern or per-extension?
3. **Pure vs side-effecting** — keep `files()` pure (return pairs, core writes)?
   This spike says yes.
4. **Path ownership / collisions** across extensions writing near each other.
