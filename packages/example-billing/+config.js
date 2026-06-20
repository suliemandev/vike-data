// Example feature extension (billing). It creates its own `subscriptions` table,
// and ALSO adds a column to auth's `users` table via extendSchema, demonstrating
// 3rd-party column contribution across independent extensions.
import { defineSchema, extendSchema } from 'vike-data/schema'

export default {
  name: 'example-billing',
  extends: ['import:vike-data/config:default'],
  schemas: [
    defineSchema('subscriptions', (t) => {
      t.uuid('id').primary()
      t.uuid('user_id')
      t.string('plan')
      t.integer('seats').default(1)
      t.boolean('active').default(true)
      t.timestamps()
    }),
    // 3rd-party ADD: billing adds a column to the `users` table auth created.
    extendSchema('users', (t) => {
      t.string('stripe_customer_id').nullable()
    }),
  ],
}
