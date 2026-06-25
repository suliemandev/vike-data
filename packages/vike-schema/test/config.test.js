// The Vike binding config (+config.js): the `schemas` cumulative contribution point and the
// dogfooded `_migrations` ledger table vike-schema owns.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSchemas } from '@vike-data/vike-schema/schema'
import config from '../+config.js'

test('declares the package name', () => {
  assert.equal(config.name, '@vike-data/vike-schema')
})

test('declares `schemas` as a server+config cumulative contribution point', () => {
  assert.deepEqual(config.meta.schemas, {
    env: { config: true, server: true },
    cumulative: true,
  })
})

test('contributes its own `_migrations` ledger table to `schemas`', () => {
  assert.ok(Array.isArray(config.schemas))
  const { tables, conflicts } = mergeSchemas(config.schemas)
  assert.equal(conflicts.length, 0)
  const migrations = tables.find((t) => t.table === '_migrations')
  assert.ok(migrations, 'expected a _migrations table')

  const col = (name) => migrations.columns.find((c) => c.name === name)
  assert.equal(col('id').type, 'integer')
  assert.equal(col('id').primary, true)
  assert.equal(col('name').type, 'string')
  assert.equal(col('name').unique, true)
  assert.equal(col('batch').type, 'integer')
})
