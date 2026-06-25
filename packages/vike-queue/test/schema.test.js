import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jobsSchema } from '../schema.js'

// The `jobs` table vike-queue owns (the Stem pattern). These pin the fragment the
// database driver depends on, so the status/attempts/run_at contract the worker
// reads can't silently drift from the schema that creates the table.

const col = (name) => jobsSchema.columns.find((c) => c.name === name)

test('it is a create fragment for jobs', () => {
  assert.equal(jobsSchema.mode, 'create')
  assert.equal(jobsSchema.table, 'jobs')
})

test('id is a primary uuid', () => {
  const c = col('id')
  assert.equal(c.type, 'uuid')
  assert.equal(c.primary, true)
})

test('name and payload are strings', () => {
  assert.equal(col('name').type, 'string')
  assert.equal(col('payload').type, 'string')
})

test('status defaults to pending; attempts/max_attempts default to 0/1', () => {
  assert.equal(col('status').type, 'string')
  assert.equal(col('status').default, 'pending')
  assert.equal(col('attempts').default, 0)
  assert.equal(col('max_attempts').default, 1)
})

test('run_at and failed_at are nullable timestamps; last_error a nullable string', () => {
  assert.equal(col('run_at').type, 'timestamp')
  assert.equal(col('run_at').nullable, true)
  assert.equal(col('failed_at').type, 'timestamp')
  assert.equal(col('failed_at').nullable, true)
  assert.equal(col('last_error').type, 'string')
  assert.equal(col('last_error').nullable, true)
})

test('timestamps() adds created_at + updated_at defaulting to now', () => {
  assert.deepEqual(
    ['created_at', 'updated_at'].map((n) => [col(n)?.type, col(n)?.default]),
    [['timestamp', 'now'], ['timestamp', 'now']],
  )
})
