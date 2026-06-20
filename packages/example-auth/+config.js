// Example feature extension (auth). It declares its tables ONCE via the neutral
// schema DSL and contributes them through vike-data's `schemas` point. It does
// not know which ORM the app uses, and does not author any migration.
//
// NOTE: ideally this would also `extends: ['vike-data/config']` so installing
// auth pulls vike-data in automatically. From source that fails (Vike runs its
// import->pointer transform only on the app's own +config files, not on extension
// configs loaded from node_modules), so the app wires vike-data in directly. That
// gap is itself a finding worth confirming with Vike.
import { defineSchema } from 'vike-data/schema'

export default {
  name: 'example-auth',
  schemas: [
    defineSchema('users', (t) => {
      t.uuid('id').primary()
      t.string('email').unique()
      t.string('name').nullable()
      t.boolean('active').default(true)
      t.timestamps()
    }),
    defineSchema('sessions', (t) => {
      t.uuid('id').primary()
      t.uuid('user_id')
      t.timestamp('expires_at')
      t.timestamps()
    }),
  ],
}
