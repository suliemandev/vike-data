// The `notes` table, defined through the universal ORM's schema DSL (vike-schema).
// vike-auth owns `users` / `sessions` / `login_tokens`; this app owns `notes`. Both ride
// the same registered adapter, so swapping memory for a real DB later is one line in
// bootstrap.ts and this definition does not change.
import { defineSchema } from '@vike-data/vike-schema/schema'

export const notesSchema = defineSchema('notes', (t) => {
  t.integer('id').primary()
  t.string('title')
  t.text('body')
  t.text('summary').nullable()
  t.string('created_at')
})
