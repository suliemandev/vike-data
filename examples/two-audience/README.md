# app-two-audience

The **two-audience reference app** ([epic #255](https://github.com/suleimansh/vike-data/issues/255)):
two independent auth audiences in one app, the composition proof for vike-auth's named
guards.

A **staff** audience (the `admin` guard over `admins`) and a **customer** audience (the
`client` guard over `clients`) coexist, each with its own login page, session cookie, and
endpoint namespace. The default `users` guard stays available and byte-for-byte unchanged.
Both can be signed in at once in the same browser with no cross-talk, and logging one out
leaves the other untouched.

> Phase history: Phase 0 ([#266](https://github.com/suleimansh/vike-data/issues/266)) stood
> up the single-audience skeleton; Phase 1 ([#267](https://github.com/suleimansh/vike-data/issues/267))
> added the named guards documented here;
> [#278](https://github.com/suleimansh/vike-data/issues/278) bound vike-storage to the staff
> guard and [#279](https://github.com/suleimansh/vike-data/issues/279) bound vike-notifications to
> the client guard (the downstream "which subject" seam,
> [#207](https://github.com/suleimansh/vike-data/issues/207) P3). Org ownership
> ([#250](https://github.com/suleimansh/vike-data/issues/250)) and a Vue twin are later phases.

## The guards

Declared once in [`guards.js`](./guards.js), imported by both `+config.js` (to contribute
each guard's tables + login routes) and `+onCreateGlobalContext.js` (to register the
runtime instances):

```js
import { defineGuard } from 'vike-auth/guards'

export const guards = [
  defineGuard('admin',  { table: 'admins' }),
  defineGuard('client', { table: 'clients' }),
]
```

| | staff (`admin`) | customer (`client`) | default user |
|---|---|---|---|
| login page | `/admin/login` | `/client/login` | `/login` |
| endpoints | `/admin-auth/*` | `/client-auth/*` | `/auth/*` |
| session cookie | `vike_auth_session__admin` | `vike_auth_session__client` | `vike_auth_session` |
| resolved user | `pageContext.guards.admin.user` | `pageContext.guards.client.user` | `pageContext.user` |

The home page resolves all three side by side. See
[`vike-auth`'s README](../../packages/vike-auth/README.md#named-guards-multi-instance) for
the API.

## Composition proof: the Stem pattern

This app is a worked proof of how vike-data extensions **compose** — each owns a slice and
they assemble through Vike's config, with no extension reaching into another.

**Each extension auto-defines and composes its own tables.** Every table here is contributed
to the one cumulative `schemas` point and merged + derived together:

- vike-auth's default guard owns `users` / `sessions` / `login_tokens`;
- each named guard owns its own trio — `admins` / `admin_sessions` / `admin_login_tokens`,
  and the `clients` set — contributed by `guards.flatMap((g) => g.schemas)`;
- vike-storage owns `uploads`; vike-notifications owns `notifications`.

No extension imports another's tables; they meet only in the merged schema — the same way
auth owns `users` and (in the Stem vision) a teams extension would own `organizations`.

**Guards isolate the two audiences.** A single `defineGuard('admin', { table: 'admins' })`
line (in [`guards.js`](./guards.js), the one source of truth — the registry-vs-config call
settled in [#272](https://github.com/suleimansh/vike-data/issues/272)) is a complete,
independent vike-auth instance: its own cookie, endpoint namespace, and tables. The two
audiences share nothing, so both can be signed in at once with no cross-talk.

**Ownership is a composition choice, not a hardcode.** vike-storage and vike-notifications
don't bake in whose rows they own. The app **binds** each to a guard with one sibling config
key (`storageGuard: 'admin'`, `notificationsGuard: 'client'`) plus its runtime env twin — so a
staff upload is owned by `admins` and a client notification by `clients`. Set neither and both
fall back to the default `users` subject, byte-for-byte (the
[#207](https://github.com/suleimansh/vike-data/issues/207) P3 "which subject" seam, the owner
half of [#250](https://github.com/suleimansh/vike-data/issues/250)).

The result: install an extension via `extends`, configure it with a sibling key, and the
slices compose — three audiences, per-audience tables, and subject-bound storage +
notifications — in ~5 small files.

## What's wired

- **vike-auth/react** + **vike-auth/react/guards** — the keystone plus the opt-in named-guards
  tier (the dispatcher middleware, the `pageContext.guards` render hook, the `authGuard`
  page meta).
- **vike-themes/react + vike-theme-emerald** — a brand (light + dark) plus the
  `system`/`light`/`dark` appearance axis.
- **vike-layouts/react** — the app shell (`topbar`; the login pages use `centered`).
- **vike-storage** — bound to the staff guard (`storageGuard: 'admin'`), so a staff upload is
  owned by the `admins` subject. See below.
- **vike-notifications** — bound to the client guard (`notificationsGuard: 'client'`), so the
  in-app feed is owned by the `clients` subject. See below.

## Storage owned by the staff guard (#278 / #207 P3)

The downstream **"which subject" seam**: vike-storage hardcodes neither the owner table nor the
session it reads. This app binds it to the staff audience, so a file uploaded as staff is owned
by the `admins` subject, not the default user.

```js
// pages/+config.js
storageGuard: 'admin',          // build-time: uploads.user_id FKs into `admins`, not `users`
```

```js
// pages/+onCreateGlobalContext.js
process.env.VIKE_STORAGE_GUARD ??= 'admin'   // runtime: resolve the uploader from the admin cookie
```

Two knobs, one for each half — the same config/env split vike-stripe uses for
`segment`/`BILLING_SEGMENT`:

| half | knob | effect |
|---|---|---|
| schema (build) | `storageGuard: 'admin'` | the `uploads.user_id` FK target follows the admin guard's subject (`admins`) |
| runtime (request) | `VIKE_STORAGE_GUARD=admin` | the `/uploads` endpoint resolves the owner from the **admin** session cookie |

Leave both unset and storage owns uploads by the default `users` subject, byte-for-byte. The home
page shows a **staff-only uploader** and lists the signed-in admin's own files (loaded server-side
in `pages/index/+data.js`); a client or the default user sees a prompt, never another audience's
files.

## Notifications owned by the client guard (#279 / #207 P3)

The notifications half of the **same seam**: vike-notifications also hardcodes neither the owner
table nor the session its feed reads. This app binds it to the **customer** audience, so a
notification sent to a client is owned by the `clients` subject and read from the client's own feed
— the mirror image of storage binding to staff.

```js
// pages/+config.js
notificationsGuard: 'client',          // build-time: notifications.user_id FKs into `clients`, not `users`
```

```js
// pages/+onCreateGlobalContext.js
process.env.VIKE_NOTIFICATIONS_GUARD ??= 'client'   // runtime: resolve the reader from the client cookie

// The seam exists to write `notify('c-1', notification)` — a row owned by the `clients`
// subject. This demo SEEDS that row directly (adapter.insert into `notifications`) rather than
// calling notify() at boot, only to keep vike-notifications' server module — it pulls in
// node:crypto, which Vike externalizes for the browser — out of this once-per-server hook. The
// notify() -> client-subject WRITE path is covered end to end by the package tests; here the
// home page just READS the seeded feed, client-only. (See "What's verified end to end" below.)
```

The same two-knob, config/env split as storage:

| half | knob | effect |
|---|---|---|
| schema (build) | `notificationsGuard: 'client'` | the `notifications.user_id` FK target follows the client guard's subject (`clients`) |
| runtime (request) | `VIKE_NOTIFICATIONS_GUARD=client` | the `/notifications` feed + a bare-id `notify()` resolve against the **client** guard |

Leave both unset and notifications own the feed by the default `users` subject, byte-for-byte. The
seed writes the client's welcome notification (directly, per the note above); the home page shows a
**client-only feed** of those notifications (loaded server-side in `pages/index/+data.js`); staff or
the default user sees a prompt, never the client's notifications.

Everything runs on an in-process **memory adapter** (zero database) registered in
`pages/+onCreateGlobalContext.js`, seeded with one row per audience: staff
`boss@example.com`, client `customer@example.com`, default user `ada@example.com`. Sign in
with the magic link printed to the dev console; the seeded row is reused (looked up by
email).

## What's verified end to end

Honest coverage, mirroring the live-verify discipline across vike-data — some paths need real
infrastructure and are proven elsewhere, not in this demo.

**Verified live in this running app** (on the in-process memory adapter):

- **Guard isolation.** Three guards resolve independently from three separate session
  cookies: sign into staff + client + the default user in one browser and all three show
  signed in, and logging one out leaves the others untouched (the home page).
- **Staff upload, full round trip.** `FileUpload` POSTs to `/uploads`, the endpoint resolves
  the uploader from the **admin** cookie, the row's `user_id` FKs into `admins`, and the home
  page lists that admin's own files — never another audience's.
- **Client feed ownership + read.** The home page reads `notifications` where `user_id` is the
  **client** subject, client-only.
- **Schema composition.** All guards' tables plus `uploads` and `notifications` merge + derive
  together (gated by the codegen fixture + the package tests).

**Not exercised live here** (proven elsewhere, or needs real infrastructure):

- The `notify('c-1', ...)` **write** call is not made at boot — the demo seeds the feed row
  directly to keep vike-notifications' server module (node:crypto) out of the once-per-server
  hook. The `notify()` → client-subject write path is covered by the vike-notifications
  package tests.
- **Magic-link email** goes to the **dev console/outbox**, not a real inbox — no transport is
  registered (same as the other demos). Real delivery needs a Resend key.
- This app runs on the **memory adapter** (zero database); the Drizzle and Rudder adapters are
  proven against a real database elsewhere (vike-stripe's signature-verified webhooks, the
  codegen drift fixture).
- A **Vue twin** is deferred ([epic #255](https://github.com/suleimansh/vike-data/issues/255)).

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter app-two-audience dev
```

Then open http://localhost:4300 (distinct from `app-react` on 4100 and `app-vue` on 4200).
Sign into staff and client in the same browser to watch both resolve independently.
