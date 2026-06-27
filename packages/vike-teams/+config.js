// vike-teams — the composition proof of the Stem Vision. It is a feature
// extension that builds ON TOP of vike-auth's schema in two ways:
//
//   1. it references auth's `users` table by `user_id` (memberships, owner_id);
//   2. it ADDS a column to auth's `users` table via extendSchema, without
//      vike-auth knowing teams exists.
//
// It self-installs vike-auth (which itself self-installs vike-schema), so a single
// `extends: ['import:vike-teams/config:default']` pulls in the whole chain:
// vike-schema <- vike-auth <- vike-teams. That is the Stem Vision in one line:
// installing one extension composes everything it depends on.
import { defineSchema, extendSchema } from '@vike-data/vike-schema/schema'
import { resolveSubject } from 'vike-auth/subject'
import { resolveTeamSubject } from './subject.js'

// vike-teams FKs into auth's subject table, so it must FOLLOW a renamed auth subject
// (VIKE_AUTH_SUBJECT_TABLE) the same way the other downstream extensions do (PR #215),
// not hardcode the literal 'users'. Default resolves to 'users', so the zero-config
// app is unchanged. Resolved once at config-eval (env is build-time data).
const USERS = resolveSubject().users

// teams ALSO owns its OWN subject (organizations + memberships). Like auth, those
// table names are configurable (VIKE_TEAMS_ORGANIZATIONS_TABLE / _MEMBERSHIPS_TABLE),
// resolved HERE so the schema is the single source. Defaults are today's names.
const { organizations: ORGS, memberships: MEMBERSHIPS, invitations: INVITATIONS } = resolveTeamSubject()

export default {
  name: 'vike-teams',
  extends: ['import:vike-auth/config:default'],
  schemas: [
    defineSchema(ORGS, (t) => {
      t.uuid('id').primary()
      t.string('name')
      t.string('slug').unique()
      // FK into auth's subject table — a cross-extension reference. merge.js
      // validates the table exists; deleting an owner is restricted, not cascaded.
      t.uuid('owner_id').references(`${USERS}.id`, { onDelete: 'restrict' })
      t.timestamps()
    }),
    defineSchema(MEMBERSHIPS, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id').references(`${ORGS}.id`, { onDelete: 'cascade' })
      t.uuid('user_id').references(`${USERS}.id`, { onDelete: 'cascade' }) // auth owns this table
      t.string('role').default('member')
      t.timestamps()
    }),
    // Pending invitations (#292): invite an email into an org, accept to create a membership.
    // Single-use + expiring, the same token shape vike-auth's `login_tokens` use. `invited_by`
    // FKs into auth's subject (SET NULL so deleting the inviter keeps the audit-light row); the
    // org FK cascades so revoking an org clears its invites. The runtime tier lives in
    // ./invitations.js — this is just the table the flow reads + writes through universal-orm.
    defineSchema(INVITATIONS, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id').references(`${ORGS}.id`, { onDelete: 'cascade' })
      t.string('email')
      t.string('role').default('member')
      t.string('token').unique()
      t.string('status').default('pending') // pending | accepted | revoked
      t.timestamp('expires_at')
      t.timestamp('accepted_at').nullable()
      t.uuid('invited_by').nullable().references(`${USERS}.id`, { onDelete: 'set null' })
      t.timestamps()
    }),
    // 3rd-party ADD: teams adds the user's active org to auth's subject table,
    // AND points it back at its own organizations table — a cross-extension FK
    // in BOTH directions (subject <-> organizations is a relation cycle). vike-auth
    // never declared this column; merge flags it as `added`. The FK target follows
    // the teams rename; the column name itself is a teams-owned literal.
    extendSchema(USERS, (t) => {
      t.uuid('current_organization_id').nullable().references(`${ORGS}.id`, { onDelete: 'set null' })
    }),
  ],
}
