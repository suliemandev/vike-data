// Example feature extension (auth). It declares its tables ONCE via the neutral
// schema DSL and contributes them through vike-data's `schemas` point. It does
// not know which ORM the app uses, and does not author any migration.
//
// It self-installs vike-data: `extends: ['import:vike-data/config:default']` uses
// Vike's pre-serialized pointer-import string, which works from a node_modules
// extension config (it doesn't rely on the app-only import->pointer transform).
// So installing auth pulls vike-data in automatically; the app needn't wire it.
import { defineSchema } from 'vike-data/schema'

export default {
  name: 'example-auth',
  extends: ['import:vike-data/config:default'],
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
