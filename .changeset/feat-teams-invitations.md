---
'vike-teams': minor
---

vike-teams: invitation flow — invite an email into an organization, accept to create a membership (#292).

Adds the package's first runtime tier (it was previously pure schema). A new `invitations` table (org FK cascade, email, role, single-use `token`, `status`, `expires_at`, `accepted_at`, `invited_by` SET-NULL FK into auth's subject) and `vike-teams/invitations`:

- `inviteToMembership({ organizationId, email, role?, invitedBy?, ttlMs? })` → creates a pending, expiring invite and returns the opaque token; **delivering the accept link is the app's job** (no mail dependency).
- `acceptInvitation(token, subject)` → validates token + expiry + email match, then creates the membership with the invited role. Single-use (atomic pending→accepted, the same race-safe consume vike-auth uses for login tokens) and idempotent (already-a-member is a no-op success). `subject` may be the default user or a named guard's user — vike-teams is guard-agnostic and just FKs into the resolved `users` table.
- `revokeInvitation(id)` (pending→revoked, idempotent) and `listInvitations(organizationId, { status? })`.

The `invitations` table name is configurable via `VIKE_TEAMS_INVITATIONS_TABLE`, like the other team tables. All runtime access goes through the neutral `universal-orm` adapter, so it runs on whichever ORM the app installed. Out of scope (separate concerns): the email template/transport and seat-limit/billing gating. Zero-config apps are unchanged.
