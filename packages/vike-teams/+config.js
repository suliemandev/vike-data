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

// vike-teams FKs into auth's subject table, so it must FOLLOW a renamed subject
// (VIKE_AUTH_USERS_TABLE) the same way the other downstream extensions do (PR #215),
// not hardcode the literal 'users'. Default resolves to 'users', so the zero-config
// app is unchanged. Resolved once at config-eval (env is build-time data).
const USERS = resolveSubject().users

export default {
  name: 'vike-teams',
  extends: ['import:vike-auth/config:default'],
  schemas: [
    defineSchema('organizations', (t) => {
      t.uuid('id').primary()
      t.string('name')
      t.string('slug').unique()
      // FK into auth's subject table — a cross-extension reference. merge.js
      // validates the table exists; deleting an owner is restricted, not cascaded.
      t.uuid('owner_id').references(`${USERS}.id`, { onDelete: 'restrict' })
      t.timestamps()
    }),
    defineSchema('memberships', (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id').references('organizations.id', { onDelete: 'cascade' })
      t.uuid('user_id').references(`${USERS}.id`, { onDelete: 'cascade' }) // auth owns this table
      t.string('role').default('member')
      t.timestamps()
    }),
    // 3rd-party ADD: teams adds the user's active org to auth's subject table,
    // AND points it back at its own `organizations` table — a cross-extension FK
    // in BOTH directions (subject <-> organizations is a relation cycle). vike-auth
    // never declared this column; merge flags it as `added`.
    extendSchema(USERS, (t) => {
      t.uuid('current_organization_id').nullable().references('organizations.id', { onDelete: 'set null' })
    }),
  ],
}
