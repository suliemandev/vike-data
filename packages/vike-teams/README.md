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

> Cross-table references (`user_id`, `organization_id`, `owner_id`) are by `uuid`
> convention today. Enforced foreign keys / relations are the deferred **v2
> relations** surface that this keystone motivates.
