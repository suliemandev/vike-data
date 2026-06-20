// vike-data: the data-layer extension.
//
// It defines ONE contribution point: a custom CUMULATIVE config named `schemas`.
// Every extension (and vike-data itself) contributes declarative schema fragments
// to it via defineSchema / extendSchema. vike-data collects them, merges them
// into final tables, and DERIVES migrations + per-ORM artifacts from the result
// (see app/pages/+onRenderHtml.js for the consumer).
//
// Schema is the single source of truth. There is no hand-authored migration list.
//
// (The schema DSL + compilers live at `vike-data/schema`; splittable into a
// standalone `vike-schema` package later.)
import { defineSchema } from './schema/index.js'

export default {
  name: 'vike-data',

  meta: {
    schemas: {
      env: { config: true, server: true },
      cumulative: true,
    },
  },

  // vike-data dogfoods its own contribution point with its migration-ledger table.
  schemas: [
    defineSchema('_migrations', (t) => {
      t.integer('id').primary()
      t.string('name').unique()
      t.integer('batch')
    }),
  ],
}
