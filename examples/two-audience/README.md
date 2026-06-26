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
> added the named guards documented here. Org ownership and a Vue twin are later phases.

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

## What's wired

- **vike-auth/react** + **vike-auth/react/guards** — the keystone plus the opt-in named-guards
  tier (the dispatcher middleware, the `pageContext.guards` render hook, the `authGuard`
  page meta).
- **vike-themes/react + vike-theme-emerald** — a brand (light + dark) plus the
  `system`/`light`/`dark` appearance axis.
- **vike-layouts/react** — the app shell (`topbar`; the login pages use `centered`).

Everything runs on an in-process **memory adapter** (zero database) registered in
`pages/+onCreateGlobalContext.js`, seeded with one row per audience: staff
`boss@example.com`, client `customer@example.com`, default user `ada@example.com`. Sign in
with the magic link printed to the dev console; the seeded row is reused (looked up by
email).

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter app-two-audience dev
```

Then open http://localhost:4300 (distinct from `app-react` on 4100 and `app-vue` on 4200).
Sign into staff and client in the same browser to watch both resolve independently.
