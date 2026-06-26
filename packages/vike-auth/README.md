# vike-auth

The keystone auth extension for the [vike-data](../../README.md) Stem Vision: an
extension that **owns everything auth needs**, starting with its database tables.

It declares `users` and `sessions` once through the neutral schema DSL and
contributes them through vike-schema's cumulative `schemas` config point. It does
not know which ORM the app uses, and it authors no migrations — the schema is the
source of truth, and per-ORM artifacts (Prisma / Drizzle / Rudder) are derived
from it.

## Tier

The framework-agnostic **core** tier (schema **and** a working server-side session
lifecycle, no UI) lives at the package root. Per-framework UI ships as **subpaths of
this one package** — `vike-auth/react` today, `vike-auth/vue` / `vike-auth/solid`
later — each layering components, hooks, and its own pages on top while reusing this
exact schema and server tier. The core-vs-UI split moved from a package boundary to a
module boundary, mirroring `universal-middleware` and the single-package decision in
#51. `vike-auth/react` also **ships its own `/login` + `/account` pages** via
`config.pages`: install it and the routes appear, with no page file in the app.
A guard on `/login` bounces an already-signed-in visitor to the app's post-login
home — set it with the **`loginRedirect`** config key (default `/`):

```js
// pages/+config.js
import authExt from 'vike-auth/react'
export default {
  extends: [authExt],
  loginRedirect: '/admin', // signed-in users hitting /login land here
}
```

## Tables

| table          | columns                                                                |
|----------------|------------------------------------------------------------------------|
| `users`        | id, email (unique), name, password_hash, email_verified, active, timestamps |
| `sessions`     | id, user_id, token (unique), expires_at, timestamps                    |
| `login_tokens` | id, email, token (unique), expires_at, consumed_at, timestamps         |

### Renaming the subject + tables

By default the subject is `User` over `users` / `sessions` / `login_tokens`. An app
that wants different names sets them once, through env, and **both** the schema and
the runtime store pick the rename up from the same source:

```bash
VIKE_AUTH_SUBJECT=Account              # the subject label (default: User)
VIKE_AUTH_USERS_TABLE=accounts         # default: users  (re-points the sessions/login_tokens FK)
VIKE_AUTH_SESSIONS_TABLE=account_sessions        # default: sessions
VIKE_AUTH_LOGIN_TOKENS_TABLE=account_login_tokens # default: login_tokens
```

Env, not a `+config` value, is the knob on purpose: the runtime store is built at
module import with no access to the resolved config, so routing both halves through
env keeps the override a **single source** they can never disagree on (the
vike-stripe `BILLING_SEGMENT` precedent). With nothing set, behaviour is byte-for-byte
the default. The FK **column** stays `user_id`; only its target table follows the rename.

> Single-instance only. Using vike-auth for two subjects at once (a `User` guard **and**
> a `Client` guard), and letting downstream extensions (teams/push/billing) bind to a
> renamed subject, are later phases (see the epic). A downstream package that hardcodes
> `users` (e.g. vike-teams' FK) still targets `users`, so renaming the subject is for a
> standalone vike-auth today.

## Server tier

vike-auth is not schema-only: it ships a working **passwordless, magic-link**
auth flow, and it owns it the same way it owns its tables. Two things are
contributed from `+config.js`:

- **`middleware`** — a [universal middleware](https://github.com/magne4000/universal-middleware)
  (server-agnostic: Hono / Express / Cloudflare / the Vike dev server) that owns
  the auth endpoints and the session cookie:

  | route | method | does |
  |---|---|---|
  | `/auth/request`  | POST | issue a single-use magic link for a `email` form field and deliver it through the `vike-mail` port (dev: the console/outbox transport records it and the link is shown inline) |
  | `/auth/callback` | GET  | verify the token, find-or-create the user, open a session, set the cookie |
  | `/auth/logout`   | POST | destroy the session server-side and clear the cookie |

- **`onCreatePageContext`** — resolves the session cookie to `pageContext.user`,
  so any page (and `vike-auth/react`'s `useUser()`) reads one field and knows who is
  signed in, without knowing how auth works.

The lifecycle itself lives in a framework-agnostic core (`auth.js`) over a
pluggable `Store` (`store.js`) whose operations map 1:1 onto the three tables
above. The proof wires an in-memory store (the repo has no real database yet);
a real app passes a store backed by the generated ORM artifacts and the core is
unchanged. The core is usable from plain Node:

```js
import { createAuth, createMemoryStore } from 'vike-auth'

const auth = createAuth({ store: createMemoryStore() })

// requestMagicLink / redeemMagicLink return an { ok } envelope: { ok: true, email, token }
// and { ok: true, user, session } on success, or { ok: false, error } (e.g. 'expired-token').
const { token } = await auth.requestMagicLink('alice@example.com')
const { user, session } = await auth.redeemMagicLink(token)

await auth.authenticate(session.token) // -> { user, session } or null
await auth.destroySession(session.token) // real logout
```

### Design notes

- **Stateful sessions, on purpose.** The session token is opaque and stored in
  the `sessions` table, so `logout` actually destroys it. This is a deliberate
  contrast with the [vike-dashboard](https://github.com/vikejs/vike-dashboard)
  reference, which uses a stateless Ed25519-signed cookie (no `sessions` table)
  and so cannot revoke a single session. Storing the session is what makes the
  declared schema load-bearing.
- **Two findings for Vike** (both worked around in this package, both worth fixing
  upstream):
  1. On a Vike **without [#3355](https://github.com/vikejs/vike/pull/3355)**, the
     built-in `middleware` cumulative config is included once per install path.
     vike-auth is self-installed by the app *and* by vike-teams *and* by
     vike-stripe, so its middleware ran three times per request on the released
     `0.4.259` — and a universal middleware runs even after an earlier one
     returned a `Response` (a `Response` only short-circuits route *handlers*), so
     a body-reading middleware double-reads (`Body already read`). **Fixed
     upstream by #3355** (idempotent extension installation): verified against the
     `0.4.259-commit-a91659b` build, the middleware runs exactly once. This is the
     same bug as the schema layer's `_migrations` duplication, one layer up — the
     one fix covers both. The per-request `WeakSet` guard stays as back-compat for
     users on a pre-#3355 release.
  2. A **3xx redirect returned from a universal middleware crashes Vike's request
     logger**, which looks for a `Location` header with a capital `L` while the
     Web `Headers` object lower-cases it (`assert(headerRedirect)` throws). The
     endpoints use a `200` + meta-refresh instead. Filed as
     [vikejs/vike#3357](https://github.com/vikejs/vike/issues/3357) (a
     case-insensitive header lookup in `logHttpResponse` fixes it).
- **Why the user lands on `pageContext` via `onCreatePageContext` and not the
  middleware:** in Vike 0.4.259 a middleware's returned *context* is not bridged
  into `pageContext`, so the middleware can't hand `user` to the renderer. If
  Vike bridged universal-middleware context into `pageContext`, the endpoint
  handling and the user-resolution would collapse into a single middleware.
- **Magic-link issuance is rate-limited per email, not per IP.** `requestMagicLink`
  spaces links to one address by a cooldown (`magicLinkCooldownMs`, default 60s)
  and caps how many can be live at once (`maxActiveMagicLinks`, default 3), and it
  purges consumed/expired `login_tokens` (plus delete-on-consume in `redeemMagicLink`)
  so the table can't be flooded. A throttled request returns the *same* neutral notice
  as success, so it is not an existence or timing oracle. The limit state is the
  `login_tokens` rows themselves, which is **durable and correct across horizontally
  scaled instances** — the deliberate reason it lives here and not in process memory.
  Per-IP / global throttling for a cross-email flood is intentionally left to the
  edge (a WAF or a shared limiter), where in-process counters would be wrong under
  scale-out anyway.

## Install

Installing vike-auth self-installs vike-schema automatically, so the app needn't
wire it:

```js
// pages/+config.js
import authExt from 'vike-auth/config'

export default {
  extends: [authExt],
}
```

## Composition

`users` is the **composition base** of the Stem Vision. Other extensions build on
it without vike-auth knowing they exist:

- they reference `users` by `user_id` (e.g. `vike-teams` memberships, billing
  subscriptions);
- they add columns to `users` via `extendSchema('users', ...)` (e.g. `vike-teams`
  adds `current_organization_id`).

See [vike-teams](../vike-teams/README.md) for the composition proof.

> Cross-table references are real foreign keys: `sessions.user_id` is declared
> `t.uuid('user_id').references('users.id', { onDelete: 'cascade' })`, and it
> compiles to a Prisma relation, a Drizzle `.references()`, and a Rudder FK
> constraint. See the relations support in
> [`@vike-data/universal-schema`](../universal-schema).
