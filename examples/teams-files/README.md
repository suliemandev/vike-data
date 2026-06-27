# app-teams-files

The **org-owned uploads reference app** ([#284](https://github.com/suleimansh/vike-data/issues/284) —
the UI proof for [#250](https://github.com/suleimansh/vike-data/issues/250), part of
[epic #255](https://github.com/suleimansh/vike-data/issues/255)).

vike-storage is bound to the **organization** owner instead of the individual user, so an upload
belongs to the whole org: **every member sees and can delete every member's file.** Sign in as Ada
(org owner), upload a file, log out, sign in as Grace (member): Grace sees Ada's file in the same
list and can delete it.

> This app demonstrates the **owner-arity** axis (#250 — *what kind of thing* owns a row: a user vs
> an organization). It is orthogonal to the **guard** axis the
> [two-audience app](../two-audience/) demonstrates ([#278](https://github.com/suleimansh/vike-data/issues/278) —
> *which subject table* owns a row: `users` vs `admins`). This one runs the plain **default** user
> guard so ownership arity is the only moving part on show.

## Ownership bound to the organization (#250)

vike-storage hardcodes neither the owner table nor the column. The kit `resolveOwner` contract lets
an app rebind both with one sibling config key plus its runtime env twin — the same config/env split
vike-stripe uses for `segment`/`BILLING_SEGMENT`:

```js
// pages/+config.js
storageOwner: { table: 'organizations', column: 'organization_id' },
```

```js
// pages/+onCreateGlobalContext.js
process.env.VIKE_STORAGE_OWNER_COLUMN ??= 'organization_id'        // the FK column on uploads
process.env.VIKE_STORAGE_OWNER_FROM   ??= 'current_organization_id' // the field on the user row
```

Two knobs, one for each half:

| half | knob | effect |
|---|---|---|
| schema (build) | `storageOwner: { table, column }` | the `uploads` owner FK becomes `organization_id` → `organizations`, not `user_id` → `users` |
| runtime (request) | `VIKE_STORAGE_OWNER_COLUMN` | the column the `/uploads` endpoint writes + queries the owner under |
| runtime (request) | `VIKE_STORAGE_OWNER_FROM` | which field on the signed-in user resolves the owner id — here teams' `current_organization_id`, so an upload is scoped to the user's active org |

Omit `storageOwner` (and the env twins) and storage owns uploads by the default `users` subject,
**byte-for-byte** — the common single-owner path is unchanged. The owner axis composes with the
guard axis: an app can set `storageGuard` *and* `storageOwner` together (own by an org *of* admins).

## The Stem composition (#255)

vike-teams is the composition proof: installing it self-installs vike-auth, contributes
`organizations` / `memberships` / `invitations`, and **adds** `current_organization_id` to auth's
`users` table — without vike-auth knowing teams exists. The app's `extends` line pulls the whole
chain in:

```js
extends: [vikeReact, authExt, teamsExt, storageExt, themesExt, layoutsExt, emeraldExt]
```

- vike-auth's default guard owns `users` / `sessions` / `login_tokens`;
- vike-teams owns `organizations` / `memberships` / `invitations` and extends `users`;
- vike-storage owns `uploads`, with its owner FK rebound to `organizations` by `storageOwner`.

No extension imports another's tables; they meet only in the merged schema. `current_organization_id`
is the seam: teams writes it, storage reads it.

## What's wired

- **vike-auth/react** — the default user guard plus the `/login` + `/account` pages.
- **vike-teams** — `organizations` / `memberships` / `invitations` + `current_organization_id`.
- **vike-storage** — bound to the organization owner (`storageOwner`). See above.
- **vike-themes/react + vike-theme-emerald** — a brand (light + dark) plus the appearance axis.
- **vike-layouts/react** — the app shell (`topbar`; the login page uses `centered`).

Everything runs on an in-process **memory adapter** (zero database) registered in
`pages/+onCreateGlobalContext.js`, seeded with **one org (Acme Corp)** and **two members** — owner
`ada@example.com` and member `grace@example.com`, both with `current_organization_id` = Acme — plus
one org-owned file. Sign in with the magic link printed to the dev console; the seeded row is reused
(looked up by email).

## What's verified end to end

Honest coverage, mirroring the live-verify discipline across vike-data.

**Verified live in this running app** (on the in-process memory adapter):

- **Org ownership, full round trip.** `FileUpload` POSTs to `/uploads`; the endpoint resolves the
  owner from the signed-in user's `current_organization_id` (not their own id) and writes the row
  under `organization_id`. The home page lists files by `organization_id`.
- **Cross-member visibility + delete.** Sign in as Ada and as Grace: both see the identical file
  list, and either can delete any file (the `DELETE /uploads/:id` owner check matches on the shared
  `organization_id`).
- **Schema composition.** auth's + teams' tables plus `uploads` (owner FK rebound to
  `organizations`) merge + derive together (gated by the codegen fixture + the package tests).

**Not exercised live here** (proven elsewhere, or needs real infrastructure):

- The seeded org file's row is inserted directly (rather than via `storeUpload`) to keep
  vike-storage's server module (node:crypto) out of the once-per-server hook; its bytes are primed
  in the built-in memory blob store. The `storeUpload` → org-owner write path is covered by the
  vike-storage package tests, and live by any upload made in the running app.
- **Magic-link email** goes to the **dev console/outbox**, not a real inbox — no transport is
  registered (same as the other demos). Real delivery needs a Resend key.
- This app runs on the **memory adapter** (zero database); the Drizzle and Rudder adapters are
  proven against a real database elsewhere.
- A **Vue twin** is deferred ([epic #255](https://github.com/suleimansh/vike-data/issues/255)).

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter app-teams-files dev
```

Then open http://localhost:4400 (distinct from `app-react` on 4100, `app-vue` on 4200 and
`app-two-audience` on 4300). Sign in as `ada@example.com`, upload a file, then sign in as
`grace@example.com` to watch the same org file list and delete across members.
