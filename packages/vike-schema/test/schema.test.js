// The DSL re-export (schema.js): `@vike-data/vike-schema/schema` must surface the full
// universal-schema DSL + helpers, so an extension author gets them from one dependency.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as schema from '@vike-data/vike-schema/schema'

test('re-exports the schema DSL and the merge/derive/generate helpers as functions', () => {
  for (const name of [
    'defineSchema',
    'extendSchema',
    'resolveSchemas',
    'orderFragments',
    'mergeSchemas',
    'generateArtifacts',
  ]) {
    assert.equal(typeof schema[name], 'function', `expected ${name} to be re-exported`)
  }
})

test('the re-exported defineSchema actually builds a fragment', () => {
  const frag = schema.defineSchema('widgets', (t) => t.uuid('id').primary())
  assert.equal(frag.table, 'widgets')
  assert.equal(frag.mode, 'create')
  assert.equal(frag.columns[0].name, 'id')
})
