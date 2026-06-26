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

test('dispatch coerces maxAttempts: non-finite / <= 0 -> 1, a float is floored', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  setQueueDriver(createDatabaseDriver()) // enqueue-only, so the row records max_attempts
  registerJob('j', async () => {})

  await dispatch('j', null)                       // no opts -> 1
  await dispatch('j', null, { maxAttempts: 0 })   // <= 0 -> 1
  await dispatch('j', null, { maxAttempts: -5 })  // negative -> 1
  await dispatch('j', null, { maxAttempts: NaN }) // non-finite -> 1
  await dispatch('j', null, { maxAttempts: 3.9 }) // floored -> 3

  const got = (await adapter.find('jobs', {})).map((r) => r.max_attempts)
  assert.deepEqual(got, [1, 1, 1, 1, 3])
})

test('database driver: work() is a no-op when nothing is pending', async () => {
  reset()
  setAdapter(createMemoryAdapter())
  const driver = createDatabaseDriver()
  assert.deepEqual(await driver.work(), { processed: 0, done: 0, failed: 0, rescheduled: 0 })
})

test('database driver: work() drains several ready jobs in one pass', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  setQueueDriver(createDatabaseDriver())
  const seen = []
  registerJob('many', async (p) => { seen.push(p) })

  await dispatch('many', { n: 1 })
  await dispatch('many', { n: 2 })
  await dispatch('many', { n: 3 })

  const s = await getQueueDriver().work()
  assert.deepEqual(s, { processed: 3, done: 3, failed: 0, rescheduled: 0 })
  assert.equal(seen.length, 3)
  assert.equal((await adapter.find('jobs', { status: 'done' })).length, 3)
})

test('database driver: work({ max }) caps how many are processed per pass', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  const driver = createDatabaseDriver()
  setQueueDriver(driver)
  registerJob('capped', async () => {})

  await dispatch('capped', null)
  await dispatch('capped', null)
  await dispatch('capped', null)

  const s = await driver.work({ max: 2 })
  assert.equal(s.processed, 2)
  assert.equal(s.done, 2)
  // the third row is untouched, still pending for a later pass
  assert.equal((await adapter.find('jobs', { status: 'pending' })).length, 1)
})

test('database driver: work() skips a job whose run_at is in the future', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  // a fixed clock so "the future" is unambiguous relative to work()'s now
  const driver = createDatabaseDriver({ now: () => '2026-01-01T00:00:00.000Z' })
  setQueueDriver(driver)
  let ran = false
  registerJob('later', async () => { ran = true })

  await adapter.insert('jobs', {
    id: 'j-future', name: 'later', payload: 'null', status: 'pending',
    attempts: 0, max_attempts: 1, run_at: '2026-01-01T01:00:00.000Z', // an hour out
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  })

  const s = await driver.work()
  assert.deepEqual(s, { processed: 0, done: 0, failed: 0, rescheduled: 0 })
  assert.equal(ran, false)
  assert.equal((await adapter.find('jobs', { id: 'j-future' }))[0].status, 'pending')
})

test('database driver: work() treats a null run_at as ready', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  const driver = createDatabaseDriver()
  setQueueDriver(driver)
  let ran = false
  registerJob('immediate', async () => { ran = true })

  const ts = '2026-01-01T00:00:00.000Z'
  await adapter.insert('jobs', {
    id: 'j-null', name: 'immediate', payload: 'null', status: 'pending',
    attempts: 0, max_attempts: 1, run_at: null, created_at: ts, updated_at: ts,
  })

  const s = await driver.work()
  assert.deepEqual(s, { processed: 1, done: 1, failed: 0, rescheduled: 0 })
  assert.equal(ran, true)
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

// --- atomic claim + zombie reclaim (#237) ------------------------------------

test('database driver: two concurrent work() drains never run a job twice (atomic claim)', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  setQueueDriver(createDatabaseDriver())

  let runs = 0
  // The handler awaits a tick, so both drains have read the row as pending before either
  // resolves — exactly the race that duplicate execution needs.
  registerJob('once', async () => { await Promise.resolve(); runs++ })
  await dispatch('once', null)

  const [a, b] = await Promise.all([getQueueDriver().work(), getQueueDriver().work()])
  assert.equal(runs, 1) // ran exactly once despite two overlapping drains
  // exactly one drain claimed + processed it; the other saw no claimable row
  assert.equal(a.processed + b.processed, 1)
  assert.equal(a.done + b.done, 1)
  assert.equal((await adapter.find('jobs', { status: 'done' })).length, 1)
})

test('database driver: a job is running while in flight, then done', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  setQueueDriver(createDatabaseDriver())

  let statusDuringRun = null
  registerJob('inflight', async () => {
    statusDuringRun = (await adapter.find('jobs', {}))[0].status
  })
  await dispatch('inflight', null)
  await getQueueDriver().work()

  assert.equal(statusDuringRun, 'running') // claimed before the handler ran
  assert.equal((await adapter.find('jobs', {}))[0].status, 'done')
})

test('database driver: a stale running row (crashed worker) is reclaimed and retried', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  let clock = Date.parse('2026-01-01T00:00:00.000Z')
  const driver = createDatabaseDriver({
    now: () => new Date(clock).toISOString(),
    visibilityTimeoutMs: 1000,
  })
  setQueueDriver(driver)

  let ran = false
  registerJob('recover', async () => { ran = true })

  // a row left 'running' by a crashed worker an hour ago, attempts still under max
  await adapter.insert('jobs', {
    id: 'j-zombie', name: 'recover', payload: 'null', status: 'running',
    attempts: 0, max_attempts: 2, run_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  })

  clock += 5000 // past the 1s visibility window
  const s = await driver.work()
  assert.equal(ran, true) // reclaimed -> pending -> claimed -> run
  assert.equal(s.done, 1)
  assert.equal((await adapter.find('jobs', { id: 'j-zombie' }))[0].status, 'done')
})

test('database driver: a fresh running row is NOT reclaimed (within the visibility window)', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  const ts = '2026-01-01T00:00:00.000Z'
  const driver = createDatabaseDriver({ now: () => ts, visibilityTimeoutMs: 60000 })
  setQueueDriver(driver)

  let ran = false
  registerJob('busy', async () => { ran = true })
  await adapter.insert('jobs', {
    id: 'j-busy', name: 'busy', payload: 'null', status: 'running',
    attempts: 1, max_attempts: 3, run_at: ts, created_at: ts, updated_at: ts, // just claimed
  })

  const s = await driver.work()
  assert.equal(ran, false) // still owned by its worker
  assert.deepEqual(s, { processed: 0, done: 0, failed: 0, rescheduled: 0 })
  assert.equal((await adapter.find('jobs', { id: 'j-busy' }))[0].status, 'running')
})

test('database driver: a reclaimed job that exhausted its attempts is failed, not rerun', async () => {
  reset()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  let clock = Date.parse('2026-01-01T00:00:00.000Z')
  const driver = createDatabaseDriver({
    now: () => new Date(clock).toISOString(),
    visibilityTimeoutMs: 1000,
  })
  setQueueDriver(driver)

  let runs = 0
  registerJob('poison', async () => { runs++ })
  // crashed on its only allowed attempt (attempts already == max_attempts)
  await adapter.insert('jobs', {
    id: 'j-poison', name: 'poison', payload: 'null', status: 'running',
    attempts: 1, max_attempts: 1, run_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  })

  clock += 5000
  const s = await driver.work()
  assert.equal(runs, 0) // not run again
  assert.deepEqual(s, { processed: 1, done: 0, failed: 1, rescheduled: 0 })
  assert.equal((await adapter.find('jobs', { id: 'j-poison' }))[0].status, 'failed')
})
