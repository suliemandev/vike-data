import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import {
  registerJob, getJob, dispatch, runJob, backoffMs,
  setQueueDriver, getQueueDriver, clearQueue,
} from '../index.js'
import { createInlineDriver } from '../inline.js'
import { createDatabaseDriver } from '../database.js'

function reset() {
  clearQueue()
  clearAdapter()
}

test('registerJob / getJob round-trips, validates', () => {
  reset()
  const handler = async () => {}
  registerJob('x', handler)
  assert.equal(getJob('x'), handler)
  assert.throws(() => registerJob('', handler), /non-empty string/)
  assert.throws(() => registerJob('y', null), /must be a function/)
})

test('dispatch runs inline by default (no driver set)', async () => {
  reset()
  const seen = []
  registerJob('greet', async (payload) => { seen.push(payload) })
  await dispatch('greet', { name: 'ada' })
  assert.deepEqual(seen, [{ name: 'ada' }])
})

test('runJob retries up to maxAttempts then throws the last error', async () => {
  reset()
  let calls = 0
  registerJob('flaky', async () => { calls++; throw new Error('boom ' + calls) })
  await assert.rejects(
    () => runJob('flaky', null, { maxAttempts: 3, sleep: async () => {} }),
    /boom 3/,
  )
  assert.equal(calls, 3)
})

test('runJob succeeds on a later attempt', async () => {
  reset()
  let calls = 0
  registerJob('eventually', async () => { calls++; if (calls < 2) throw new Error('not yet'); return 'ok' })
  const r = await runJob('eventually', null, { maxAttempts: 3, sleep: async () => {} })
  assert.equal(r, 'ok')
  assert.equal(calls, 2)
})

test('runJob throws for an unregistered job', async () => {
  reset()
  await assert.rejects(() => runJob('nope', null), /no job registered for "nope"/)
})

test('backoff grows and caps at 30s', () => {
  assert.equal(backoffMs(1), 100)
  assert.equal(backoffMs(2), 200)
  assert.equal(backoffMs(3), 400)
  assert.equal(backoffMs(20), 30_000)
})

test('setQueueDriver swaps the active driver; clearQueue restores inline', () => {
  reset()
  const custom = createInlineDriver()
  setQueueDriver(custom)
  assert.equal(getQueueDriver(), custom)
  assert.throws(() => setQueueDriver({}), /enqueue\(\)/)
  clearQueue()
  // a fresh inline default (not the custom one)
  assert.notEqual(getQueueDriver(), custom)
})

test('database driver: enqueue inserts a pending row; work() runs it to done', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  setQueueDriver(createDatabaseDriver())

  const seen = []
  registerJob('send', async (payload) => { seen.push(payload) })

  const res = await dispatch('send', { to: 'a@b.c' })
  assert.equal(res.status, 'pending')

  // enqueue did NOT run the job (a worker must drain it)
  assert.deepEqual(seen, [])
  let rows = await adapter.find('jobs', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, 'pending')

  const summary = await getQueueDriver().work()
  assert.deepEqual(summary, { processed: 1, done: 1, failed: 0, rescheduled: 0 })
  assert.deepEqual(seen, [{ to: 'a@b.c' }])
  rows = await adapter.find('jobs', {})
  assert.equal(rows[0].status, 'done')
  assert.equal(rows[0].attempts, 1)
})

test('database driver: payload round-trips JSON; an absent payload arrives as null', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  setQueueDriver(createDatabaseDriver())

  const seen = []
  registerJob('echo', async (payload) => { seen.push(payload) })

  await dispatch('echo', { a: 1, nested: { b: [2, 3] } })
  await dispatch('echo', undefined) // JSON.stringify(undefined ?? null) -> 'null'
  await getQueueDriver().work()

  assert.deepEqual(seen[0], { a: 1, nested: { b: [2, 3] } })
  assert.equal(seen[1], null)
})

test('database driver: a corrupt payload column is swallowed to null (parsePayload)', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  const driver = createDatabaseDriver()
  setQueueDriver(driver)

  let received = 'unset'
  registerJob('parse', async (p) => { received = p })

  // a row written with a non-JSON payload (e.g. a corrupted/legacy row)
  const ts = '2026-01-01T00:00:00.000Z'
  await adapter.insert('jobs', {
    id: 'j-corrupt', name: 'parse', payload: '{not json',
    status: 'pending', attempts: 0, max_attempts: 1, run_at: ts, created_at: ts, updated_at: ts,
  })

  const summary = await driver.work()
  assert.deepEqual(summary, { processed: 1, done: 1, failed: 0, rescheduled: 0 })
  assert.equal(received, null) // corrupt JSON -> null, handler still runs, row marked done
  const row = (await adapter.find('jobs', { id: 'j-corrupt' }))[0]
  assert.equal(row.status, 'done')
})

test('database driver: a failing job reschedules, then fails at max_attempts', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  // advancing clock: the reschedule sets run_at = now + backoff, so the second pass
  // must see a later `now` for the job to be ready again.
  let clock = Date.parse('2026-01-01T00:00:00.000Z')
  const driver = createDatabaseDriver({ now: () => new Date(clock).toISOString() })
  setQueueDriver(driver)

  registerJob('boom', async () => { throw new Error('nope') })
  await dispatch('boom', { x: 1 }, { maxAttempts: 2 })

  // first pass: one attempt, not yet at max -> rescheduled into the (near) future
  let s = await driver.work()
  assert.deepEqual(s, { processed: 1, done: 0, failed: 0, rescheduled: 1 })
  let row = (await adapter.find('jobs', {}))[0]
  assert.equal(row.status, 'pending')
  assert.equal(row.attempts, 1)
  assert.match(row.last_error, /nope/)

  // advance past the backoff window, second pass: attempts hit max_attempts -> failed
  clock += 1000
  s = await driver.work()
  assert.deepEqual(s, { processed: 1, done: 0, failed: 1, rescheduled: 0 })
  row = (await adapter.find('jobs', {}))[0]
  assert.equal(row.status, 'failed')
  assert.equal(row.attempts, 2)
  assert.ok(row.failed_at)
})
