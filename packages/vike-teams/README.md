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
| `invitations`   | id, organization_id, email, role, token (unique), status, expires_at, accepted_at, invited_by, timestamps |
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
| `VIKE_TEAMS_INVITATIONS_TABLE`   | `invitations`   |

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

## Invitations

Add a member who does not have an account yet: invite an email, the invitee accepts,
and a membership is created with the invited role. This is the package's first runtime
tier (it was previously pure schema); it reads and writes through the neutral
`universal-orm` adapter, so it runs on whatever ORM the app installed.

```js
import { inviteToMembership, acceptInvitation, revokeInvitation, listInvitations } from 'vike-teams/invitations'

// Issue an invite (server-side). Returns the opaque token; DELIVERING the accept link
// is the app's job — build a URL and send it through vike-mail, your own mailer, etc.
const { token } = await inviteToMembership({
  organizationId: org.id,
  email: 'new@example.com',
  role: 'admin',            // the membership role granted on accept (default 'member')
  invitedBy: currentUser.id,
})

// Accept it as the signed-in user. `subject` is { id, email } — the default user OR a
// named guard's user (vike-teams is guard-agnostic). The accepting email must match the
// invited email; the invite is single-use and expiring.
const result = await acceptInvitation(token, subject)
// -> { ok: true, membership, alreadyMember, organizationId, role }
// -> { ok: false, error: 'invalid-token' | 'revoked' | 'used' | 'expired' | 'email-mismatch' | 'no-subject' }

await revokeInvitation(inviteId)            // pending -> revoked (idempotent)
await listInvitations(org.id)               // pending invites, newest first
await listInvitations(org.id, { status: null }) // every status
```

- **Single-use + expiring.** Acceptance flips the row from `pending` to `accepted`
  atomically (the same race-safe consume `vike-auth` uses for login tokens), so a token
  works exactly once; invites default to a 7-day TTL (`ttlMs` overrides it).
- **Idempotent.** Accepting when already a member returns `{ ok: true, alreadyMember: true }`
  without creating a duplicate.
- **Delivery is app-owned.** This is the primitive (tokens + accept/revoke/list); the email
  template and transport are out of scope — pair it with `vike-mail` if you want.

Server-only: `vike-teams/invitations` holds the adapter and mints tokens, so it must never
reach the client bundle.
