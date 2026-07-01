// The one schema this whole app is built from. `posts` is declared once through the neutral
// schema DSL and contributed to the cumulative `schemas` point in +config.js. vike-view derives
// the list / record / form view-models straight from it: a column that exists here appears in the
// UI, its type picks the input control, a non-null column with no default is required. No second
// place describes the fields.
//
// `user_id` is the OWNER key. It is a plain uuid (no FK to a users table -- this example carries
// no auth), and the view's `scope` (views.js) bounds every read and write to the signed-in user's
// rows through it. It is left out of the list/form refinements so the user never sees or sets it;
// the scoped write path fills it.
import { defineSchema } from '@vike-data/vike-schema/schema'

export const postsSchema = defineSchema('posts', (t) => {
  t.uuid('id').primary()
  t.string('title')
  t.text('body').nullable()
  t.boolean('published').default(false)
  t.uuid('user_id')
  t.timestamps()
})

export default [postsSchema]
