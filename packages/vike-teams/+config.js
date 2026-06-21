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

export default {
  name: 'vike-teams',
  extends: ['import:vike-auth/config:default'],
  schemas: [
    defineSchema('organizations', (t) => {
      t.uuid('id').primary()
      t.string('name')
      t.string('slug').unique()
      t.uuid('owner_id') // -> users.id (by convention; FKs are v2)
      t.timestamps()
    }),
    defineSchema('memberships', (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id') // -> organizations.id
      t.uuid('user_id') // -> users.id (auth owns this table)
      t.string('role').default('member')
      t.timestamps()
    }),
    // 3rd-party ADD: teams adds the user's active org to auth's `users` table.
    // vike-auth never declared this column; merge flags it as `added`.
    extendSchema('users', (t) => {
      t.uuid('current_organization_id').nullable()
    }),
  ],
}
