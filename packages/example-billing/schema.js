// The billing extension defines its table once, in the neutral DSL.
import { defineSchema } from 'vike-data/schema'

export default [
  defineSchema('subscriptions', (t) => {
    t.uuid('id').primary()
    t.uuid('user_id')
    t.string('plan')
    t.integer('seats').default(1)
    t.boolean('active').default(true)
    t.timestamps()
  }),
]
