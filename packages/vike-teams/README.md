# vike-teams

Teams / multi-tenancy extension, and the **composition proof** of the
[vike-data](../../README.md) Stem Vision: it builds on top of
[vike-auth](../vike-auth/README.md)'s schema without vike-auth knowing it exists.

## How it composes on vike-auth

1. **References** auth's `users` table by `user_id` (memberships) and `owner_id`
   (organizations).
2. **Extends** auth's `users` table via `extendSchema('users', ...)`, adding
   `current_organization_id`. The merge layer flags this as an `added` column;
   vike-auth's own declaration is untouched.
3. **Self-installs** vike-auth (`extends: ['import:vike-auth/config:default']`),
   which self-installs vike-schema. So a single install pulls in the whole chain:

   ```
   vike-schema  <-  vike-auth  <-  vike-teams
   ```

## Tables

| table           | columns                                                       |
|-----------------|---------------------------------------------------------------|
| `organizations` | id, name, slug (unique), owner_id, timestamps                 |
| `memberships`   | id, organization_id, user_id, role (default `member`), timestamps |
| `users` (+)     | adds `current_organization_id` to vike-auth's table           |

## Install

```js
// pages/+config.js — installing teams alone pulls in auth + vike-schema
import teamsExt from 'vike-teams/config'

export default {
  extends: [teamsExt],
}
```

## Configurable table names

By default vike-teams owns `organizations` + `memberships`. Product vocabulary
varies (teams / companies / workspaces / tenants), so the table names are
configurable through one env-based knob, the same way vike-auth renames its
subject (`VIKE_AUTH_*`). Read once at config-eval by `vike-teams/subject`, so the
schema is the single source.

| env var                          | default         |
|----------------------------------|-----------------|
| `VIKE_TEAMS_SUBJECT`             | `Organization`  |
| `VIKE_TEAMS_ORGANIZATIONS_TABLE` | `organizations` |
| `VIKE_TEAMS_MEMBERSHIPS_TABLE`   | `memberships`   |

Renaming the org table follows through every FK that targets it (the
membership `organization_id` and the `current_organization_id` added to auth's
table). FKs INTO auth's subject still follow the auth rename
(`VIKE_AUTH_SUBJECT_TABLE`) independently. Defaults are byte-for-byte today's
behaviour, so the zero-config app is unchanged. Column names (`slug`/`role`/etc.)
are reserved in the resolver but not yet env-backed, since vike-teams ships no
runtime that reads them by name.

> Cross-table references (`user_id`, `organization_id`, `owner_id`) are real
> foreign keys via `.references('table.column', { onDelete })`. `merge.js`
> validates the target exists across extensions, so a FK into auth's `users`
> only resolves once vike-auth is installed (a dangling ref is a flagged
> conflict, not a crash). `users` <-> `organizations` is a relation cycle, and it
> compiles cleanly to all three ORMs. See the relations support in
> [`@vike-data/universal-schema`](../universal-schema).
