// The auth extension defines its tables ONCE, in the neutral DSL. It does not
// know or care which ORM the end user's app runs.
import { defineSchema } from 'vike-data/schema'

export default [
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
]
