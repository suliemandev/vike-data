# vike-data (experiment)

> **Status: experiment / spike.** Not published. APIs are throwaway and the ORM
> compilers emit representative output (they don't run against a real database yet).
> This repo explores a design; it isn't meant to be installed.

A proof that a **[Vike](https://vike.dev) extension can own and compose a whole
vertical slice** of an app: its database tables, its server behaviour, and its UI
(pages, auth, themes, layouts, translations). You install an extension and get all
of it, composing through Vike's config with the app on top.

**The model in one line:**

> Each extension declares its slice once. Vike collects every contribution through
> cumulative config. The app picks options and composes everyone together.

Two consequences run through everything here:

- **Derive, don't author.** Schema is the single source of truth; migrations and
  per-ORM files are *generated* from it. The same idea applies up the stack: themes
  are derived to CSS variables, the active translation is merged per locale.
- **Compose, don't wire.** An app installs an extension with `extends: [ext]` and
  configures it with a sibling key (`theme`, `layout`, `locale`, `billingSubject`),
  exactly like `vike-react`'s `ssr`. No bespoke wiring per extension.

---

## Two layers

### 1. Data layer — schema as the source of truth

Extensions declare tables with `defineSchema('users', t => ...)` (or `extendSchema`
to add columns to a table another extension created). `vike-schema` collects every
contribution through one cumulative `schemas` config point, merges them, **derives**
the migration list, and **compiles** the result to **Prisma, Drizzle, or a native
engine** — the same schema, three targets. Foreign keys validate *across* extensions;
billing's schema is even *computed* from an app option.

### 2. UI tier — themes, layouts, auth, i18n

Same pattern, applied to the frontend. Each concern is a framework-agnostic **core**
plus a thin **React binding** (so a `vike-vue-*` could reuse the core). The app
installs each and sets a sibling config key:

- **Themes** — a brand (light + dark tokens) compiled to CSS variables, plus an
  *appearance* axis (`system` / `light` / `dark`; `system` follows the OS, flash-free).
- **Layouts** — pick an app shell (`centered` / `topbar` / `sidebar`) per page.
- **Auth UI** — `<SignInForm>` / `<UserButton>` / `useUser()` over vike-auth's server tier.
- **i18n** — extensions ship their own strings; translations merge per locale. The
  base ships English; other languages are separate, installable **locale packs**.

Themes and translations **compose like packages**: install `vike-theme-emerald` and a
new theme appears in the picker; install `vike-react-auth-fr` and the auth UI speaks
French. Neither the app nor the extension being styled/translated knows the other exists.

---

## Structure

| Package | Owns |
|---|---|
| **Data layer** | |
| `universal-schema` | The neutral schema IR + DSL, merge/derive logic, per-ORM compilers. **Zero Vike imports.** |
| `universal-orm` | The neutral, narrow repository (`db.<table>.insert/find/upsert/update/delete`) over the composed schema + the adapter contract. Runtime twin of `universal-schema`. **Zero Vike, zero ORM imports.** |
| `vike-schema` | Vike binding: the cumulative `schemas` config point + the codegen Vite plugin. |
| `vike-auth` | Auth core: owns `users` / `sessions` / `login_tokens` + a magic-link server tier (universal middleware + `pageContext.user`). React UI + its own `/login` + `/account` pages ship as the `vike-auth/react` subpath. |
| `vike-teams` | Orgs + memberships; references and extends `users`. Self-installs vike-auth. |
| `vike-stripe` | Stripe billing as subpath models: `b2c-subscription` (upsert) + `b2b-payment` (insert). Subject FK *computed* from `billingSubject`; server tier writes via universal-orm on a webhook. Self-installs vike-teams. |
| **UI tier** (core + React binding) | |
| `vike-themes` (+ `vike-themes/react`) | Tokens → CSS variables; the `theme` (brand) + `appearance` axes + `useTheme()`. |
| `vike-theme-emerald` | Example theme package (composes via the cumulative `themes` config). |
| `vike-layouts` (+ `vike-layouts/react`) | Shell selection + slot config; the `<CenteredShell>` / `<TopbarShell>` / `<SidebarShell>`. |
| `vike-react-auth-fr` | French locale pack for `vike-auth/react`. |
| `vike-i18n` / `vike-react-i18n` | Cumulative `messages` + `locale`; `useTranslation()` → `t()` + a locale picker. |
| **Apps** | |
| `app` | Data-layer demo: the merged schema rendered + compiled to all three ORMs. |
| `app-react` | UI-tier demo: a themed, localized, passwordless login + topbar home. |

The split is consistent: every core is framework-agnostic and Vike-agnostic where it
can be; every Vike-/React-specific concern lives in a `vike-*` / `vike-react-*` binding.

---

## Run it

```bash
pnpm install

# Data-layer demo — schema merged + compiled to an ORM (default drizzle)
cd app && pnpm dev            # http://localhost:4000
pnpm dev:prisma               # or dev:drizzle / dev:native
pnpm gen:prisma               # write the per-ORM artifacts (gen:drizzle / gen:native)
pnpm gen:check                # CI drift gate: fail if committed artifacts are stale

# UI-tier demo — themed + localized login
cd app-react && pnpm dev      # http://localhost:4100
```

In `app-react`, switch **Language** (bottom-left) and **Appearance / Theme**
(bottom-right) live. The login flow is passwordless: submit an email, then open the
magic link printed in the `pnpm dev` console.

Run the package tests with `pnpm -r test`.

---

## How composition works

1. A binding **declares a cumulative config point** via `meta` (`schemas`, `themes`,
   `messages`). It is framework-agnostic config — just a contribution channel.
2. Each extension **contributes** to it (a schema fragment, a theme, a message map)
   and **self-installs** its base with a pointer-import
   (`extends: ['import:vike-themes/config:default']`), so one install pulls the chain.
3. The app **picks** with a sibling key (`theme: 'acme'`, `locale: 'en'`) and can
   **override** any contribution (retranslate a string, restyle a theme).
4. The consumer **merges + derives**: schema → migrations + ORM files; themes →
   the active CSS; messages → the dictionary for the active locale.

Non-serializable contributions (a computed schema, a live component for a Wrapper/
Layout) are passed as **pointer-imports**, since Vike serializes runtime config and
rejects inline functions.

---

## Notes & deferred

Per-package design notes live in each package's README (see
[vike-auth](packages/vike-auth/README.md), [vike-stripe](packages/vike-stripe/README.md)).
Highlights and open ends:

- **Relations** — single-column FKs with `onDelete`, cross-extension validation,
  self-referential FKs, and overridable Prisma relation-field names all work; deriving
  the relation graph lets Prisma's multiple/circular-relation case fall out for free.
  Deferred: composite keys, many-to-many through-table sugar.
- **Runtime data access** — extensions read/write through `universal-orm` (a narrow
  `db.<table>.upsert/find/...` over the composed schema) on a swappable adapter
  (`@universal-orm/memory`, `@universal-orm/drizzle`), never importing an ORM.
  vike-stripe's webhooks are the live proof: `b2c-subscription` upserts, `b2b-payment` inserts.
- **Event-sourcing** was dropped from billing (brillout's steer): a plain mutable
  table is the shape real apps use. It pressured the IR (no first-class *append-only*
  or *projection-of*), so it parks as a candidate IR shape to discuss, not baked in.
- **i18n** builds on Vike's locale *routing* (`onBeforeRoute` + `pageContext.locale`);
  it adds the message-*composition* layer Vike leaves to userland. RTL (`dir` from
  locale) and a `vike-react-auth-ar` pack are the next step.
- **Upstream:** cumulative config is the right primitive; a few rough edges were filed
  and fixed (idempotent extension installation
  [vike#3354](https://github.com/vikejs/vike/issues/3354), redirect-logger casing
  [vike#3357](https://github.com/vikejs/vike/issues/3357)).
- Compilers emit representative artifacts; they don't run against real databases yet.
