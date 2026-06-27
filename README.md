# vike-data

> **Status: active development, pre-release.** Nothing is on npm yet (every package is
> private `0.x`), so APIs can still move. The design is settled and the extensions run for
> real (the Drizzle path reads and writes a real Postgres in tests). This repo explores how
> far a single Vike extension can compose.

A proof that a **[Vike](https://vike.dev) extension can own a whole vertical slice** of an
app: its database tables, its server behaviour, and its UI (pages, auth, admin, themes,
layouts, translations). You install one extension and get all of it, composed through
Vike's config with your app on top.

**The model, in one line:**

> Each extension declares its slice once. Vike collects every contribution through
> cumulative config. The app picks options and composes everyone together.

Two ideas follow from that, and they run through everything here:

- **Derive, don't author.** The schema is the single source of truth; migrations and
  per-ORM files are generated from it. The same holds up the stack: themes derive to CSS
  variables, translations merge per locale, and the admin UI is derived from the composed
  schema.
- **Compose, don't wire.** An app installs an extension with `extends: [ext]` and
  configures it with one sibling key (`theme`, `layout`, `locales`, `segment`), just like
  `vike-react`'s `ssr`. There is no bespoke wiring per extension.

---

## Two layers

### 1. Data layer: the schema is the source of truth

An extension declares its tables with `defineSchema('users', t => ...)`, or `extendSchema`
to add columns to a table another extension created. `vike-schema` collects every
contribution through one cumulative `schemas` point, merges them, **derives** the migration
list, and **compiles** the result to **Prisma, Drizzle, or the Rudder engine**: one schema,
three targets. Foreign keys are validated *across* extensions, and billing's schema is even
*computed* from an app option.

At runtime, extensions read and write through `universal-orm`: a narrow, neutral repository
(`db.<table>.insert / find / findOne / upsert / update / delete`, plus paging and `count`)
over the composed schema. The app installs one adapter and hands it a connection; no
extension ever imports an ORM.

### 2. UI tier: admin, themes, layouts, auth, i18n

The same pattern, applied to the frontend. Each concern is a framework-agnostic **core**
plus a thin **React binding** (so a `vike-vue-*` could reuse the core). The app installs
each one and sets a sibling config key:

- **Admin** (`vike-admin`): a working admin panel on install. It ships `/admin/*` pages
  that list, create, edit, and delete the rows of every composed table, gated by auth and
  rendered in your themed layout. Columns and fields are **derived** from the schema;
  `defineResource` refines them (FK selects, sortable/searchable columns, per-row
  `scope(user)` access). It writes no ORM code.
- **Themes** (`vike-themes`): a brand (light + dark tokens) compiled to CSS variables, plus
  an *appearance* axis (`system` / `light` / `dark`, where `system` follows the OS,
  flash-free).
- **Layouts** (`vike-layouts`): pick an app shell (`centered` / `topbar` / `sidebar`) per
  page.
- **Auth UI** (`vike-auth/react`): `<SignInForm>` / `<UserButton>` / `useUser()` over
  vike-auth's server tier, plus the `/login` and `/account` pages the extension owns.
- **i18n** (`vike-i18n`): extensions ship their own strings, and translations merge per
  locale. English ships inline as the universal fallback; other languages are subpaths
  (`vike-auth/fr`, `vike-auth/ar`).

Everything **composes like packages**. Install `vike-theme-emerald` and a new theme appears
in the picker; add `'fr'` to `locales` and every installed extension's French strings light
up. Neither the app nor the extension being styled, translated, or administered knows the
other exists.

#### Zero-config languages

The app names its languages once, and every installed extension's matching pack is included
automatically, with no per-pack import:

```js
locales: ['en', 'fr', 'ar']   // pulls in vike-auth/fr + /ar, and any other extension's packs
```

`vike-i18n/plugin` (a Vite plugin) reads `locales` plus a cumulative `localePacks` registry
that each extension advertises, then generates a virtual module that statically imports only
the catalogs whose locale is listed. Unused locales tree-shake out of the bundle, and Vike
never has to resolve a runtime-computed `extends`. Drop a locale and it leaves the client
bundle entirely.

---

## Structure

> For the layering, the composition mechanism, and the runtime + codegen lifecycle, see
> **[Architecture.md](Architecture.md)**. To build an extension, see
> **[AUTHORING.md](AUTHORING.md)**. Per-package detail is in each package's README.

Packages are grouped by layer. Each row is a one-line summary; the full design for a
package is in its own README. A trailing _Subpaths:_ note in the Owns column lists the
subpaths a package ships (its per-framework UI, language packs, or plugin/RPC seams).

<!-- Package-name cells use a non-breaking hyphen (U+2011) so names like `vike-notifications-mail` do not wrap mid-name in GitHub's tables. The real install names (normal hyphens) are in each package's README and package.json. -->

### Data layer

The neutral schema + ORM core, the per-ORM adapters, and the Vike bindings that wire them.

| Package | Owns |
|---|---|
| `universal‑schema` | The neutral schema IR + DSL, the merge/derive logic, and the per-ORM compilers (Prisma / Drizzle / Rudder). **Zero Vike imports.** |
| `@universal‑orm/core` | The neutral, narrow repository (`db.<table>.insert/find/findOne/upsert/update/delete`, paging + `count`) over the composed schema, plus the 6-op adapter contract. Runtime twin of `universal-schema`. **Zero Vike, zero ORM imports.** |
| `@universal‑orm/memory` | In-process adapter over plain Maps. Zero database; for tests, demos, and the proof. |
| `@universal‑orm/drizzle` | Drizzle adapter: runs the neutral calls as Drizzle queries against an app-provided connection. Tested against real Postgres (PGlite). |
| `@universal‑orm/rudder` | Rudder adapter over the `@rudderjs/database` native engine (snake_case keys pass straight through). |
| `@vike‑data/kit` | Authoring primitives the runtime ports build on: `createPort` (a provider registry with a default + validate-on-set) and `createOutbox` (a dev capture list). Zero deps, zero Vike imports. |
| `@vike‑data/vike‑schema` | Vike binding: the cumulative `schemas` config point + the codegen Vite plugin. |
| `vike‑drizzle` | Vike binding: `registerDrizzle(db, schema)` makes your Drizzle connection the `universal-orm` adapter, no manual `setAdapter`. |
| `vike‑rudder` | Vike binding: `registerRudder({ driver, url })` makes the Rudder engine the adapter (the twin of `vike-drizzle`). |

### Domain extensions

Extensions that own real business tables and self-install their base.

| Package | Owns |
|---|---|
| `vike‑auth` | Auth core: owns `users` / `sessions` / `login_tokens` + a magic-link server tier (`pageContext.user`); the link is delivered through the `vike-mail` port. UI + the `/login` + `/account` pages ship as framework subpaths; `/fr` + `/ar` are language subpaths. _Subpaths:_ `/react`, `/vue`, `/fr`, `/ar`. |
| `vike‑teams` | Orgs + memberships; references and extends `users`. Self-installs vike-auth. |
| `vike‑rbac` | Roles & permissions: owns the role/permission tables + a cumulative `permissions` registry + one `can(user, permission)` / `hasRole(user, role)` that pages, vike-admin, and a Telefunc RPC seam all share. Self-installs vike-auth. _Subpaths:_ `/telefunc`. |
| `vike‑stripe` | Stripe billing as subpath models: `subscription` (upsert) + `purchase` (insert); subject FK *computed* from `segment` (`b2b`/`b2c`); writes via universal-orm on a signature-verified webhook. Self-installs vike-teams. |

### Background jobs, mail, notifications & AI

The async base layer, the delivery ports, and the channels layered on them.

| Package | Owns |
|---|---|
| `vike‑queue` | Background-job seam: a job registry + `dispatch()` over a swappable driver (inline for dev, a universal-orm `jobs` table, or a broker later). The base everything else queues onto. |
| `vike‑mail` | The mail port: `sendMail()` + a swappable transport (console/outbox in dev, Resend/SES/SMTP in prod), sending through `vike-queue`. |
| `vike‑notifications` | Multi-channel director: `notify(user, notification)` fans one intent to email + push + an in-app feed per `via()`, over `vike-queue`. Owns the `notifications` table + `/notifications` feed + a per-framework bell. Concrete channels are separate adapter packages. _Subpaths:_ `/react`, `/vue`. |
| `vike‑notifications‑mail` | Mail channel adapter: delivers a notification's `toMail()` through vike-mail's `sendMail`. Separate so the core stays closed for modification. |
| `vike‑notifications‑push` | Push channel adapter: delivers a notification's `toPush()` through vike-push's `sendPush`. Separate so the core stays closed for modification. |
| `vike‑notifications‑stripe` | Billing-to-notifications bridge: notifies the user when a subscription goes `past_due`. Depends on vike-stripe + vike-notifications; neither depends on it. |
| `vike‑push` | Web Push channel: `sendPush(userId, payload)` over stored subscriptions + a swappable transport (console/outbox in dev, Web Push/VAPID in prod). Owns `push_subscriptions` + a `/push/subscribe` endpoint + a client control + service worker. _Subpaths:_ `/react`, `/vue`. |
| `vike‑storage` | File storage / uploads: a swappable storage port (`put` / `get` / `delete` / `url`), an `uploads` table + a multipart `POST /uploads` + owner-scoped `DELETE /uploads/:id`. Registers a `file` widget into the shared field-widget registry, so `.as('file')` renders an uploader in any consumer. _Subpaths:_ `/react`, `/vue`. |
| `vike‑ai` | The AI port: `generate()` / `chat()` / `stream()` + a swappable, server-only provider (echo in dev; Rudder AI / Vercel AI SDK / Anthropic in prod). Multi-vendor lives inside the provider via a per-call `model` / `provider` selector. |
| `vike‑ai‑gemstack` | GemStack provider for `vike-ai`: `registerGemstackAi()` routes the port's calls to the [`@gemstack/ai-sdk`](https://github.com/gemstack-land/gemstack) engine, mapping vike-ai's `model` / `provider` onto GemStack's `"provider/model"` selector. |

### UI tier

The frontend concerns, each a framework-agnostic core plus a thin per-framework binding.

| Package | Owns |
|---|---|
| `vike‑admin` | An admin panel on install: `/admin/*` CRUD pages derived from the composed schema; cumulative `adminResources` + `defineResource` refinements (FK selects, sort/search, per-row `scope`). _Subpaths:_ `/react`. |
| `vike‑themes` | Tokens to CSS variables; the `theme` (brand) + `appearance` axes + `useTheme()`. _Subpaths:_ `/react`. |
| `vike‑theme‑emerald` | Example theme package (composes via the cumulative `themes` config). |
| `vike‑layouts` | Shell selection + slot config; the `<CenteredShell>` / `<TopbarShell>` / `<SidebarShell>`. _Subpaths:_ `/react`. |
| `vike‑toolbar` | A fixed logo button + settings popover; a cumulative `toolbarItems` seam other extensions (the locale + theme pickers) teleport their controls into. _Subpaths:_ `/react`. |
| `vike‑i18n` | Cumulative `messages` + `locale`; `useTranslation()` to `t()` + a locale picker; the zero-config `locales` plugin; the `vike translate` CLI (tier-2 long-tail translations). _Subpaths:_ `/react`, `/plugin`. |

### Examples & fixtures

| Package | Owns |
|---|---|
| `examples/react` | UI-tier demo: a themed, localized, passwordless login + topbar home + an admin panel. |
| `examples/vue` | The Vue twin of `examples/react`: the same composition over the `vike-*/vue` subpaths. |
| `examples/two‑audience` | Two-audience reference app ([epic #255](https://github.com/suleimansh/vike-data/issues/255)): a staff guard and a customer guard side by side via vike-auth's named guards, each with its own login, cookie and tables, on the memory adapter. |
| `fixtures/codegen` | Data-layer fixture (no UI): the merged schema rendered + compiled to all three ORMs; the CI drift gate. |

The split is consistent: every core is framework- and Vike-agnostic where it can be, and
the Vike-/framework-specific concern lives in a `vike-*/react` (and `vike-*/vue`) subpath of
the same package. One package per concern, the framework as a subpath.

---

## Run it

```bash
pnpm install

# Data-layer fixture: schema merged + compiled to an ORM (default drizzle)
cd fixtures/codegen && pnpm dev   # http://localhost:4000
pnpm dev:prisma               # or dev:drizzle / dev:rudder
pnpm gen:prisma               # write the per-ORM artifacts (gen:drizzle / gen:rudder)
pnpm gen:check                # CI drift gate: fail if committed artifacts are stale

# UI-tier demo: themed + localized login + admin panel
cd examples/react && pnpm dev     # http://localhost:4100
cd examples/vue && pnpm dev       # http://localhost:4200 (the Vue twin)
cd examples/two-audience && pnpm dev  # http://localhost:4300 (epic #255: two named guards)
```

In `examples/react` (and its Vue twin `examples/vue`), switch **Language** (bottom-left) and
**Appearance / Theme** (bottom-right) live. Login is passwordless: submit an email, then
open the magic link. Delivery goes through the `vike-mail` port; with no transport
registered, the dev console/outbox records it and shows the link inline. Once signed in,
`/admin` lists and edits the composed tables.

To deliver for real, copy `examples/react/.env.example` (or `examples/vue/.env.example`) to `.env`
and fill it in: `RESEND_API_KEY` registers the Resend mail transport, and a `VAPID_PUBLIC_KEY`
+ `VAPID_PRIVATE_KEY` pair registers the Web Push transport. The demo reads them once per
server in `+onCreateGlobalContext.js`; with them unset it stays on the dev outbox, so nothing
else changes.

Run the package tests with `pnpm -r test`.

---

## How composition works

1. A binding **declares a cumulative config point** via `meta` (`schemas`, `themes`,
   `messages`, `localePacks`, `adminResources`). This is framework-agnostic config: just a
   contribution channel.
2. Each extension **contributes** to it (a schema fragment, a theme, a message map, a
   resource) and **self-installs** its base with a pointer-import
   (`extends: ['import:vike-themes/config:default']`), so one install pulls the whole chain.
3. The app **picks** with a sibling key (`theme: 'acme'`, `locales: ['en','fr']`) and can
   **override** any contribution (retranslate a string, restyle a theme).
4. The consumer **merges + derives**: schema to migrations + ORM files; themes to the
   active CSS; messages to the dictionary for the active locale; the composed schema to the
   admin UI.

Non-serializable contributions (a computed schema, a live component for a Wrapper or Layout,
a resource's `canEdit` function) are passed as **pointer-imports** or from a dedicated config
file, since Vike serializes runtime config and rejects inline functions. For build-time
module composition that a config value cannot express (which language packs to bundle), a
Vite **virtual module** does the job (see zero-config languages above).

---

## Customization

Each extension keeps a **small, deliberate config surface** and leans on **ejecting** for
the long tail: copy an extension's source into the app (`ejected/<extension>/`) and own it,
rather than exposing a setting for every edge case (the Vike
[eject](https://vike.dev/eject) escape hatch). The rule: expose the few coarse choices an
app makes constantly, and make everything finer-grained an eject. See
[CUSTOMIZATION.md](CUSTOMIZATION.md) for the model, an eject recipe, and a worked proof
(`examples/react/ejected/vike-toolbar`).

---

## Status notes

Per-package design notes live in each package's README (for example
[vike-auth](packages/vike-auth/README.md), [vike-admin](packages/vike-admin/README.md),
[vike-stripe](packages/vike-stripe/README.md)). The highlights and open ends:

- **Relations work end to end.** Single- and multi-column foreign keys with `onDelete`,
  cross-extension validation, self-references, overridable Prisma relation-field names,
  composite primary keys, and many-to-many through-table sugar (`defineJoinTable`) all
  compile; one-to-one is inferred from a `unique` or shared-primary-key FK. Deriving the
  relation graph is what lets Prisma's multiple/circular-relation case fall out for free.
- **Runtime writes are real.** vike-stripe's webhooks are the live proof: `subscription`
  upserts and `purchase` inserts against real Postgres through `vike-drizzle`, on a
  signature-verified endpoint, all via the neutral `universal-orm` repository.
- **RBAC is one shared check.** `vike-rbac` owns roles/permissions and a single
  `can(user, permission)` / `hasRole(user, role)` that pages, the admin's
  `canView`/`canEdit`, the session `scope`, and a **Telefunc RPC** (`requirePermission`) all
  reuse. Resolution rides a `resolveUser` seam in vike-auth, so the check is sync everywhere
  the user reaches. Flat roles and org-scoped roles (multi-tenancy via vike-teams) both work
  (see #103).
- **i18n adds the composition layer Vike leaves to userland.** It builds on Vike's locale
  routing and adds per-locale message merging, zero-config `locales: [...]` auto-include
  (tree-shaken per locale), and RTL that falls out of the active locale (`<html lang>` +
  `<html dir>`). A second tier, the `vike translate` CLI, AI-translates the long tail into a
  committed `translation.json` resolved behind the same `t()`, with a `--check` drift gate.
- **Event sourcing was dropped from billing** (brillout's steer): a plain mutable table is
  the shape real apps use. It pressured the IR (no first-class *append-only* or
  *projection-of*), so it parks as a candidate IR shape to discuss, not something baked in.
- **Upstream.** This leans on Vike's cumulative config and `config.pages` (extensions ship
  their own pages, [vike#3356](https://github.com/vikejs/vike/pull/3356)). A few rough edges
  were filed and fixed: idempotent extension installation
  [vike#3354](https://github.com/vikejs/vike/issues/3354) and redirect-logger casing
  [vike#3357](https://github.com/vikejs/vike/issues/3357).
- **Codegen is drift-gated.** The ORM compilers emit committed artifacts guarded by a CI
  drift check; the Drizzle runtime path runs against a real database, Prisma and the Rudder
  engine via codegen.
