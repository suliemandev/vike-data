# vike-auth

The keystone auth extension for the [vike-data](../../README.md) Stem Vision: an
extension that **owns everything auth needs**, starting with its database tables.

It declares `users` and `sessions` once through the neutral schema DSL and
contributes them through vike-schema's cumulative `schemas` config point. It does
not know which ORM the app uses, and it authors no migrations — the schema is the
source of truth, and per-ORM artifacts (Prisma / Drizzle / native) are derived
from it.

## Tier

This is the framework-agnostic **core** tier: schema and (eventually) server-side
session lifecycle, with no UI. Per-framework UI wrappers — `vike-react-auth`,
`vike-vue-auth`, `vike-solid-auth` — would layer components and hooks on top while
reusing this exact schema, mirroring the core-vs-UI split of `universal-middleware`
and the Vercel AI SDK.

## Tables

| table      | columns                                                                |
|------------|------------------------------------------------------------------------|
| `users`    | id, email (unique), name, password_hash, email_verified, active, timestamps |
| `sessions` | id, user_id, token (unique), expires_at, timestamps                    |

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

> Cross-table references are by `uuid` convention today. Enforced foreign keys /
> relations are the deferred **v2 relations** surface; this keystone is what
> motivates it.
