# vike-data

> **Status: active development, pre-release.** Not published to npm yet (every
> package is private `0.x`). The design is settled and the extensions run for real
> (the Drizzle path reads and writes a real Postgres in tests), but APIs can still
> change. This repo explores how far a Vike extension can compose.

A proof that a **[Vike](https://vike.dev) extension can own and compose a whole
vertical slice** of an app: its database tables, its server behaviour, and its UI
(pages, auth, admin, themes, layouts, translations). You install an extension and
get all of it, composing through Vike's config with the app on top.

**The model in one line:**

> Each extension declares its slice once. Vike collects every contribution through
> cumulative config. The app picks options and composes everyone together.

Two consequences run through everything here:

- **Derive, don't author.** Schema is the single source of truth; migrations and
  per-ORM files are *generated* from it. The same idea applies up the stack: themes
  are derived to CSS variables, the active translation is merged per locale, and the
  admin UI is derived from the composed schema.
- **Compose, don't wire.** An app installs an extension with `extends: [ext]` and
  configures it with a sibling key (`theme`, `layout`, `locales`, `segment`), exactly
  like `vike-react`'s `ssr`. No bespoke wiring per extension.

---

## Two layers

### 1. Data layer: schema as the source of truth

Extensions declare tables with `defineSchema('users', t => ...)` (or `extendSchema`
to add columns to a table another extension created). `vike-schema` collects every
contribution through one cumulative `schemas` config point, merges them, **derives**
the migration list, and **compiles** the result to **Prisma, Drizzle, or the Rudder
engine**: the same schema, three targets. Foreign keys validate *across* extensions,
and billing's schema is even *computed* from an app option.

At runtime, extensions read and write through `universal-orm`, a narrow neutral
repository (`db.<table>.insert/find/findOne/upsert/update/delete` plus paging and
`count`) over the composed schema. The app installs one adapter and hands it a
connection; extensions never import an ORM.

### 2. UI tier: admin, themes, layouts, auth, i18n

Same pattern, applied to the frontend. Each concern is a framework-agnostic **core**
plus a thin **React binding** (so a `vike-vue-*` could reuse the core). The app
installs each and sets a sibling config key:

- **Admin** (`vike-admin`): a working admin panel on install. It ships `/admin/*`
  pages that list, create, edit, and delete the rows of every table your extensions
  composed, gated by auth and rendered in your themed layout. Columns and fields are
  **derived** from the composed schema; a `defineResource` is the refinement (FK
  selects, sortable/searchable columns, per-row `scope(user)` access). Writes no ORM
  code.
- **Themes**: a brand (light + dark tokens) compiled to CSS variables, plus an
  *appearance* axis (`system` / `light` / `dark`; `system` follows the OS, flash-free).
- **Layouts**: pick an app shell (`centered` / `topbar` / `sidebar`) per page.
- **Auth UI**: `<SignInForm>` / `<UserButton>` / `useUser()` over vike-auth's server
  tier, plus the `/login` + `/account` pages the extension owns.
- **i18n**: extensions ship their own strings; translations merge per locale. English
  ships inline as the universal fallback; other languages are subpaths
  (`vike-auth/fr`, `vike-auth/ar`).

Everything **composes like packages**: install `vike-theme-emerald` and a new theme
appears in the picker; add `'fr'` to `locales` and every installed extension's French
strings light up (see below). Neither the app nor the extension being styled,
translated, or administered knows the other exists.

#### Zero-config languages

The app declares its languages once and every installed extension's matching pack is
included automatically, with no per-pack import:

```js
locales: ['en', 'fr', 'ar']   // pulls in vike-auth/fr + /ar, and any other extension's packs
```

`vike-i18n/plugin` (a Vite plugin) reads `locales` plus a cumulative `localePacks`
registry that each extension advertises, and generates a virtual module that
statically imports only the catalogs whose locale is in `locales`. So unused locales
tree-shake out of the bundle, and Vike never has to resolve a runtime-computed
`extends`. Drop a locale from `locales` and it leaves the client bundle entirely.

---

## Structure

> For the layering, the composition mechanism, and the runtime + codegen lifecycle, see
> **[Architecture.md](Architecture.md)**. Per-package detail is in each package's README.

| Package | Owns |
|---|---|
| **Data layer** | |
| `universal-schema` | The neutral schema IR + DSL, merge/derive logic, per-ORM compilers. **Zero Vike imports.** |
| `universal-orm` (`@universal-orm/core`) | The neutral, narrow repository (`db.<table>.insert/find/findOne/upsert/update/delete`, paging + `count`) over the composed schema, plus the 6-op adapter contract. Runtime twin of `universal-schema`. **Zero Vike, zero ORM imports.** |
| `@universal-orm/memory` | In-process adapter over plain Maps. Zero database; for tests, demos, and the proof. |
| `@universal-orm/drizzle` | Drizzle adapter: runs the neutral calls as Drizzle queries against an app-provided connection. Tested against real Postgres (via PGlite). |
| `@universal-orm/rudder` | Rudder adapter: runs the neutral calls against the `@rudderjs/database` native engine (snake_case keys pass straight through). |
| `vike-schema` (`@vike-data/vike-schema`) | Vike binding: the cumulative `schemas` config point + the codegen Vite plugin. |
| `vike-drizzle` | Vike binding: `registerDrizzle(db, schema)` makes your Drizzle connection the `universal-orm` adapter, so extensions write to your database with no manual `setAdapter` wiring. |
| `vike-rudder` | Vike binding: `registerRudder({ driver, url })` makes the Rudder engine the `universal-orm` adapter (the twin of `vike-drizzle`). |
| `vike-auth` | Auth core: owns `users` / `sessions` / `login_tokens` + a magic-link server tier (universal middleware + `pageContext.user`). React UI + its `/login` + `/account` pages ship as the `vike-auth/react` subpath; `vike-auth/fr` + `/ar` are language subpaths. |
| `vike-teams` | Orgs + memberships; references and extends `users`. Self-installs vike-auth. |
| `vike-rbac` | Roles & permissions: owns `roles` / `permissions` / `role_user` / `permission_role`, a cumulative `permissions` registry, and one `can(user, permission)` / `hasRole(user, role)` the app, vike-admin, and a Telefunc RPC seam (`vike-rbac/telefunc`) all share. Resolves onto the user via vike-auth's `resolveUser` seam. Self-installs vike-auth. |
| `vike-stripe` | Stripe billing as subpath models: `subscription` (upsert) + `purchase` (insert). Subject FK *computed* from `segment` (`b2b`/`b2c`); server tier writes via universal-orm on a webhook. Self-installs vike-teams. |
| **UI tier** (core + React binding) | |
| `vike-admin` (+ `vike-admin/react`) | An admin panel on install: `/admin/*` CRUD pages derived from the composed schema; cumulative `adminResources` + `defineResource` refinements (FK selects, sort/search, per-row `scope`). |
| `vike-themes` (+ `vike-themes/react`) | Tokens to CSS variables; the `theme` (brand) + `appearance` axes + `useTheme()`. |
| `vike-theme-emerald` | Example theme package (composes via the cumulative `themes` config). |
| `vike-layouts` (+ `vike-layouts/react`) | Shell selection + slot config; the `<CenteredShell>` / `<TopbarShell>` / `<SidebarShell>`. |
| `vike-toolbar` (+ `vike-toolbar/react`) | A fixed logo button + settings popover; a cumulative `toolbarItems` seam other extensions (e.g. the locale + theme pickers) teleport their controls into. |
| `vike-i18n` (+ `vike-i18n/react`, `vike-i18n/plugin`) | Cumulative `messages` + `locale`; `useTranslation()` to `t()` + a locale picker; the zero-config `locales` plugin; the `vike translate` CLI (tier-2 long-tail translations). |
| **Apps** | |
| `app` | Data-layer demo: the merged schema rendered + compiled to all three ORMs. |
| `app-react` | UI-tier demo: a themed, localized, passwordless login + topbar home + an admin panel. |

The split is consistent: every core is framework-agnostic and Vike-agnostic where it
can be; the Vike-/React-specific concern lives in a `vike-*/react` subpath of the same
package (one package per concern, the framework as a subpath).

---

## Run it

```bash
pnpm install

# Data-layer demo: schema merged + compiled to an ORM (default drizzle)
cd app && pnpm dev            # http://localhost:4000
pnpm dev:prisma               # or dev:drizzle / dev:rudder
pnpm gen:prisma               # write the per-ORM artifacts (gen:drizzle / gen:rudder)
pnpm gen:check                # CI drift gate: fail if committed artifacts are stale

# UI-tier demo: themed + localized login + admin panel
cd app-react && pnpm dev      # http://localhost:4100
```

In `app-react`, switch **Language** (bottom-left) and **Appearance / Theme**
(bottom-right) live. The login flow is passwordless: submit an email, then open the
magic link printed in the `pnpm dev` console. Once signed in, `/admin` lists and
edits the composed tables.

Run the package tests with `pnpm -r test`.

---

## How composition works

1. A binding **declares a cumulative config point** via `meta` (`schemas`, `themes`,
   `messages`, `localePacks`, `adminResources`). It is framework-agnostic config:
   just a contribution channel.
2. Each extension **contributes** to it (a schema fragment, a theme, a message map, a
   resource) and **self-installs** its base with a pointer-import
   (`extends: ['import:vike-themes/config:default']`), so one install pulls the chain.
3. The app **picks** with a sibling key (`theme: 'acme'`, `locales: ['en','fr']`) and can
   **override** any contribution (retranslate a string, restyle a theme).
4. The consumer **merges + derives**: schema to migrations + ORM files; themes to the
   active CSS; messages to the dictionary for the active locale; the composed schema to
   the admin UI.

Non-serializable contributions (a computed schema, a live component for a Wrapper /
Layout, a resource's `canEdit` function) are passed as **pointer-imports** or from a
dedicated config file, since Vike serializes runtime config and rejects inline
functions. For build-time module composition that a cumulative config value cannot
express (which language packs to bundle), a Vite **virtual module** does the job (see
zero-config languages above).

---

## Customization

Each extension keeps a **small, deliberate config surface** and leans on **ejecting** for
the long tail: copy an extension's source into the app (`ejected/<extension>/`) and own it,
instead of exposing a setting for every edge case (the Vike [eject](https://vike.dev/eject)
escape hatch). The rule is to expose the few coarse choices an app makes constantly and make
everything finer-grained an eject. See [CUSTOMIZATION.md](CUSTOMIZATION.md) for the model, an
eject recipe, and a worked proof (`app-react/ejected/vike-toolbar`).

---

## Notes & deferred

Per-package design notes live in each package's README (see
[vike-auth](packages/vike-auth/README.md), [vike-admin](packages/vike-admin/README.md),
[vike-stripe](packages/vike-stripe/README.md)). Highlights and open ends:

- **Relations**: single-column and composite (multi-column) FKs with `onDelete`,
  cross-extension validation, self-referential FKs, overridable Prisma relation-field
  names, composite primary keys, and many-to-many through-table sugar (`defineJoinTable`)
  all work; deriving the relation graph lets Prisma's multiple/circular-relation case fall
  out for free. One-to-one is inferred from a `unique` FK or a shared-primary-key FK.
- **Runtime data access**: extensions read and write through `universal-orm` (a narrow
  `db.<table>.upsert/find/...` with paging + `count`) on a swappable adapter
  (`@universal-orm/memory`, `@universal-orm/drizzle`), never importing an ORM.
  vike-stripe's webhooks are the live proof: `subscription` upserts, `purchase` inserts
  against real Postgres through `vike-drizzle`.
- **Admin**: list / create / edit / delete, FK `<select>`s, sortable + searchable
  columns, pagination, and per-row `scope(user)` access all work today. A JSON / agent
  query surface over the same `scope` guard (`/admin.json` + `/admin/<table>.json`,
  `?query=`, and the write verbs POST/PATCH/DELETE) ships too; richer field types are a
  follow-up.
- **RBAC**: `vike-rbac` owns roles/permissions and a single `can(user, permission)` /
  `hasRole(user, role)`; the demo's admin `canView`/`canEdit` and session `scope`
  delegate to it. Resolution rides on a `resolveUser` seam in vike-auth (auth runs
  cumulative enrichers right after it resolves `pageContext.user`, on every page) so the
  check is sync everywhere the user reaches. The same `can()` guards a **Telefunc RPC**:
  `vike-rbac/telefunc`'s `requirePermission()` reads the signed-in, role-enriched user off
  the Telefunc context (provided by a Vite plugin in dev / a universal middleware in prod),
  so a server function is authorized by exactly what the admin's `canView` enforces. Flat
  roles -> permissions plus org-scoped roles (multi-tenancy, via vike-teams memberships)
  both work today (see #103).
- **i18n**: builds on Vike's locale *routing* (`onBeforeRoute` + `pageContext.locale`)
  and adds the message-*composition* layer Vike leaves to userland, with zero-config
  `locales: [...]` auto-include via a Vite virtual module (tree-shaken per locale). RTL
  falls out of the active locale: vike-i18n drives `<html lang>` + `<html dir>`, so an
  Arabic/Hebrew locale flips the whole document and every layout shell inherits it. A
  second tier handles the long tail: `vike translate` (a `vike-translate` CLI) reads each
  extension's advertised `exports["texts"]`, AI-translates non-bundled locales into a
  committed `translation.json`, and resolves it behind the same `t()` (committed override
  → bundled pack → inline English), with a `--check` drift gate for CI.
- **Event-sourcing** was dropped from billing (brillout's steer): a plain mutable
  table is the shape real apps use. It pressured the IR (no first-class *append-only*
  or *projection-of*), so it parks as a candidate IR shape to discuss, not baked in.
- **Upstream:** cumulative config + `config.pages` (extensions ship their own pages,
  [vike#3356](https://github.com/vikejs/vike/pull/3356)) are the primitives this leans
  on; a few rough edges were filed and fixed (idempotent extension installation
  [vike#3354](https://github.com/vikejs/vike/issues/3354), redirect-logger casing
  [vike#3357](https://github.com/vikejs/vike/issues/3357)).
- ORM compilers emit committed artifacts gated by a CI drift check; the Drizzle runtime
  path is exercised against a real database, Prisma and the Rudder engine via codegen.
