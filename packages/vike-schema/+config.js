// vike-schema: the Vike binding of the data layer.
//
// It defines ONE contribution point: a custom CUMULATIVE config named `schemas`.
// Every extension (and vike-schema itself) contributes declarative schema
// fragments to it via defineSchema / extendSchema. vike-schema collects them,
// merges them into final tables, and DERIVES migrations + per-ORM artifacts from
// the result (see app/pages/+onRenderHtml.js for the consumer).
//
// Schema is the single source of truth. There is no hand-authored migration list.
//
// The neutral schema DSL + compilers live in the framework-agnostic core,
// `@vike-data/universal-schema` (re-exported here as `@vike-data/vike-schema/schema`).
import { defineSchema } from '@vike-data/universal-schema'

export default {
  name: '@vike-data/vike-schema',

  meta: {
    schemas: {
      env: { config: true, server: true },
      cumulative: true,
    },
  },

  // vike-schema dogfoods its own contribution point with its migration-ledger table.
  schemas: [
    defineSchema('_migrations', (t) => {
      t.integer('id').primary()
      t.string('name').unique()
      t.integer('batch')
    }),
  ],
}
