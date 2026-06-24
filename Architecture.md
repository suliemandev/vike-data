# Architecture

How vike-data fits together: the package layering, the one composition mechanism every
concern reuses, and the runtime + codegen lifecycle. The [README](README.md) is the
narrative tour and the per-package list; this is the structural reference. To build an
extension on these seams, see [AUTHORING.md](AUTHORING.md). Per-package detail lives in
each package's own README.

The whole system rests on one idea applied at every layer:

> An extension **declares** its slice into a cumulative config point. The consumer
> **merges + derives** the result. The app **picks** options and **composes** everyone.

Nothing wires extensions together by hand. Adding an extension is an `extends` entry;
adding a language, theme, or permission is a value in a config array.

---

## Layering

Dependencies point strictly downward. The `universal-*` core is framework- and
Vike-agnostic (zero Vike imports); the `vike-*` layer binds it to Vike; the app sits on
top and chooses the concrete ORM.

```
 app  /  app-react                         ← picks ORM + options, composes extensions
   │
   ├─ ORM bindings:  vike-drizzle · vike-rudder      ← register one adapter at startup
   │
   ├─ extensions (data):  vike-auth ← vike-rbac · vike-teams ← vike-stripe
   ├─ extensions (UI):    vike-admin · vike-themes ← vike-theme-emerald
   │                      vike-layouts · vike-toolbar · vike-i18n
   │
   └─ vike binding:  @vike-data/vike-schema           ← the `schemas` config point + codegen
        │
        ├─ @universal-orm/core   (setAdapter/getAdapter + the neutral repository)
        │     ├─ @universal-orm/memory   (tests / zero-config dev)
        │     ├─ @universal-orm/drizzle  (real Postgres via PGlite in tests)
        │     └─ @universal-orm/rudder   (the @rudderjs/database native engine)
        │
        ├─ @vike-data/universal-schema   (schema IR + DSL + per-ORM compilers; zero deps)
        │
        └─ @vike-data/kit   (createPort / createOutbox: the registry + dev-outbox primitives)
```

**Three npm scopes, by role:**

- `@vike-data/*` - the schema layer (`universal-schema`, `vike-schema`) plus the
  authoring `kit` (`createPort` / `createOutbox`, the provider-registry + dev-outbox
  primitives the runtime ports are built on).
- `@universal-orm/*` — the runtime data layer (`core` + the `memory` / `drizzle` /
  `rudder` adapters).
- bare `vike-*` — the Vike extensions and ORM bindings.

**The split is consistent:** every concern is a framework-agnostic **core** plus a thin
**`vike-*/react` subpath** (one package per concern, the framework as a subpath — so a
`/vue` subpath could reuse the same core). Extensions compose by self-installing their
base: `vike-rbac` pulls `vike-auth` pulls `@vike-data/vike-schema`, all from one
`extends: [rbacExt]`.

---

## The composition mechanism

One mechanism underlies everything: **cumulative Vike config**. A binding declares a
config key as cumulative; every extension and the app contribute to it; Vike merges the
contributions into an array the consumer reads.

```js
// a binding declares the point (e.g. vike-schema/+config.js)
export default {
  meta: { schemas: { env: { config: true, server: true }, cumulative: true } },
}

// an extension contributes + self-installs its base
// (the schema callback MUTATES t; each t.<type>(name) adds a column)
export default {
  extends: ['import:@vike-data/vike-schema/config:default'],
  schemas: [defineSchema('users', (t) => { t.uuid('id').primary(); t.string('email').unique() })],
}

// the app picks + can override
export default { extends: [authExt], segment: 'b2b' }
```

The cumulative points in use today:

| Config key | Declared by | Carries |
|---|---|---|
| `schemas` | vike-schema | table fragments (`defineSchema` / `extendSchema`) |
| `messages` | vike-i18n | translation catalogs, merged per locale |
| `localePacks` | vike-i18n | `{ locale: moduleSpecifier }` maps for the zero-config bundler |
| `themes` | vike-themes | brand definitions (`defineTheme`) |
| `permissions` | vike-rbac | permission definitions (`definePermissions`) |
| `defaultRoles` | vike-rbac | roles granted to a new signup |
| `adminResources` | vike-admin | resource refinements (carry `canView`/`canEdit`/`scope` functions) |
| `nav` | vike-layouts | app-shell nav links |
| `resolveUser` | vike-auth | user-enricher functions (rbac roles, teams org) |

**Two escape hatches** for things a serialized config value can't express:

1. **Pointer-imports** for non-serializable contributions. Vike serializes config and
   rejects inline functions, so a computed schema, a React Wrapper/Layout, or a
   resource's `canEdit` is contributed as an `'import:pkg/file:export'` string (or from a
   dedicated `+adminResources.js` file) that Vike resolves to a live value at config
   time.
2. **A Vite virtual module** for build-time *module* composition a config value can't
   drive — namely *which* language packs to bundle (see i18n codegen below).

---

## Runtime registration: the ORM adapter

Extensions never import an ORM. They call the neutral repository from
`@universal-orm/core` (`db.<table>.insert/find/findOne/upsert/update/delete` + paging +
`count`), and the app registers **one** adapter at server start — the single point where
a live database connection enters the system (it can't live in serialized config).

```js
// app/pages/+onCreateGlobalContext.js  (runs once per server)
import { registerDrizzle } from 'vike-drizzle'
import { registerRudder } from 'vike-rudder'

export default async function onCreateGlobalContext() {
  if (process.env.VIKE_DATA_ORM === 'rudder')
    return registerRudder({ driver: 'sqlite', url: process.env.DATABASE_URL || ':memory:' })
  registerDrizzle(drizzle(new PGlite()), schema)
}
```

`registerDrizzle` / `registerRudder` wrap the connection in the matching
`@universal-orm/<orm>` adapter and call `setAdapter()` on the core registry. Both are
**idempotent (first call wins)** so HMR can't fork the adapter. Extensions call
`getAdapter()` and run the same neutral ops regardless of which ORM is underneath; with
no adapter registered, the in-memory adapter backs zero-config dev and tests. This is the
runtime twin of the schema layer: `universal-schema` is the shape, `universal-orm` is the
data, both over the same composed tables.

---

## Universal middleware

Server behavior that isn't a page — magic-link auth, the admin JSON API — is a
[universal middleware](https://github.com/magne4000/universal-middleware) contributed via
the `middleware` config and run on every request:

- **`vike-auth/middleware`** handles `POST /auth/request`, `GET /auth/callback`,
  `POST /auth/logout` and otherwise falls through to Vike's renderer. (It doesn't render
  the login UI — that's the app's page.)
- **`vike-admin/api`** maps `/admin.json` + `/admin/<table>.json` (and the
  POST/PATCH/DELETE write verbs) to the matching admin page, renders it through Vike so
  every auth/rbac/data hook runs, and returns `pageContext.data` as JSON — so the agent
  API inherits the exact same auth + `scope` guards as the UI, by construction.

> Note: per-request **user resolution** happens in `onCreatePageContext` (below), not in
> the middleware, because that hook hosts the ordered `resolveUser` enricher seam (rbac
> roles, teams org) that must run right after auth resolves `user`. Vike can now bridge a
> context-returning universal middleware into `pageContext`, but a middleware can't host
> that ordered seam, so resolution stays unified in the hook.

---

## Codegen: two Vite plugins

Both follow the same pattern — a Vite plugin that runs on `buildStart` (so it fires for
both `vite build` and the dev server), reads Vike's **resolved** config graph via
`getVikeConfig()`, and emits derived artifacts. Both support a **check / drift-gate**
mode that generates in memory and fails instead of writing, for CI.

**`@vike-data/vike-schema/plugin`** reads the merged `schemas`, resolves function
contributions (e.g. vike-stripe's schema computed from `segment`), orders fragments by FK
dependency so migrations are runnable, validates cross-extension foreign keys, and
compiles to the target ORM (`VIKE_DATA_ORM=drizzle|prisma|rudder`). `VIKE_DATA_GEN=check`
is the CI gate that fails when committed artifacts are stale.

**`vike-i18n/plugin`** solves a problem a config value can't: `extends` only takes static
import strings, so the app can't compute `${ext}/${locale}` to bundle. Instead each
extension advertises its packs as plain data in the cumulative `localePacks` registry,
and the plugin generates a **virtual module** (`virtual:vike-i18n/packs`) that statically
imports only the packs whose locale is in `locales` — so unused locales tree-shake out
and Vike never resolves a runtime-computed `extends`. It also inlines any committed
tier-2 `translation.json` **after** the bundled packs (committed wins). The companion
**`vike translate` CLI** (`vike-translate` bin) is the tier-2 generator: it reads each
extension's `exports["texts"]`, AI-translates the long-tail locales into
`translation.json`, and ships a `--check` drift gate of its own.

---

## Request lifecycle

```
HTTP request
  │
  ├─ onCreateGlobalContext     once per server — app registers the ORM adapter
  │
  ├─ universal middleware      vike-auth (/auth/*), vike-admin (/admin*.json)
  │                            → handle + return a Response, or fall through
  │
  ├─ onCreatePageContext       per request, server-side:
  │      • vike-auth resolves pageContext.user from the session cookie
  │      • the resolveUser enrichers run (vike-rbac attaches roles/permissions,
  │        vike-teams attaches org) → can()/hasRole() are sync everywhere after
  │      • vike-i18n / vike-themes read locale + theme/appearance cookies
  │
  ├─ guard                     e.g. vike-admin bounces an anonymous user to /login
  │
  ├─ data hook                 listData / editData / dashboardData: build a
  │                            universal-orm repository over the composed schema,
  │                            apply the resource scope(user), return a view-model
  │
  └─ render                    onRenderHtml (SSR) / onRenderClient (hydrate)
                               using pageContext.data + .user + config
```

The admin JSON API reuses this exact path: the middleware renders the same page and
returns `pageContext.data` as JSON rather than HTML — one pipeline, two output formats,
identical guards.

---

## Design rules (the invariants)

- **Derive, don't author.** Schema is the source of truth; migrations, per-ORM files, the
  admin UI columns, the active CSS, and the per-locale dictionary are all generated from
  composed contributions.
- **Compose, don't wire.** An extension is an `extends` entry configured by a sibling key
  (`theme`, `locales`, `segment`) — never bespoke per-extension wiring.
- **Cores are framework- and ORM-agnostic.** `universal-*` has zero Vike imports;
  extensions have zero ORM imports; the Vike/React specifics live in a `vike-*/react`
  subpath.
- **One check, one guard, one repository.** `can(user, permission)` is shared by pages,
  admin, and RPCs; the resource `scope(user)` bounds every read and write; the neutral
  repository is the only data path.
- **Small config surface; eject for the tail.** Each extension exposes the few coarse
  choices apps make constantly; everything finer-grained is an
  [eject](CUSTOMIZATION.md), not a config knob.
