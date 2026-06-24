// vike-queue — the framework-agnostic CORE.
//
// A background-job seam in the same shape as the rest of the Stem set: a runtime
// JOB registry (name -> handler), a runtime DRIVER registry (where the work runs),
// and a `dispatch(name, payload)` that hands the job to the driver. Other extensions
// (vike-mail, ...) register a job and dispatch it; they never know which driver runs it.
//
// Two layers, both runtime (job handlers and drivers are LIVE code that can't be
// serialized into config), mirroring universal-orm's setAdapter/getAdapter:
//   - the DRIVER decides WHERE/WHEN a job runs (inline now, a DB row a worker drains,
//     a real broker later). Default = the inline driver, so dispatch works with zero
//     setup (the dev/demo/proof default, exactly like the memory ORM adapter).
//   - the JOB REGISTRY maps a dispatch name to its handler, so a driver that runs work
//     out-of-process (the DB driver's worker) can find the handler by name.
//
// Retries/backoff live here (runJob), so every driver inherits the same semantics.
//
// Cached on globalThis so duplicate module evaluation (pointer imports, dev HMR) can't
// fork the registries.
import { createPort } from '@vike-data/kit'
import { createInlineDriver } from './inline.js'

const JOBS_KEY = Symbol.for('vike-queue.jobs')

// The driver registry (the set/get/clear provider port), over @vike-data/kit. The
// default is the inline driver, so dispatch() works with zero config. The job registry
// below is a separate keyed Map (registerJob/getJob), not a single-value port.
const driverPort = createPort({
  name: 'vike-queue.driver',
  validate: (driver) => {
    if (!driver || typeof driver.enqueue !== 'function') {
      throw new Error('setQueueDriver: expected a driver with an enqueue() method (e.g. createDatabaseDriver())')
    }
  },
  default: createInlineDriver,
})

function jobRegistry() {
  return (globalThis[JOBS_KEY] ??= new Map())
}

/**
 * Register a job handler under a name. Idempotent per name (last registration wins),
 * so an extension can register its job at module load without guarding against double
 * evaluation. `handler` is `async (payload, ctx) => void`.
 */
export function registerJob(name, handler) {
  if (typeof name !== 'string' || !name) throw new Error('registerJob: name must be a non-empty string')
  if (typeof handler !== 'function') throw new Error(`registerJob: handler for "${name}" must be a function`)
  jobRegistry().set(name, handler)
  return name
}

/** The handler registered for a name, or undefined. */
export function getJob(name) {
  return jobRegistry().get(name)
}

/**
 * Register the app's queue driver. A driver is `{ enqueue({ name, payload, maxAttempts }) }`;
 * `enqueue` is responsible for eventually running the job (now, or via a worker). Validated
 * at the call site like setAdapter, so a malformed driver fails clearly here.
 */
export function setQueueDriver(driver) {
  driverPort.set(driver)
}

/**
 * The registered driver, or the INLINE driver when none is set — so dispatch() works
 * with zero configuration (the work runs immediately, in process). An app swaps in a
 * real driver by calling setQueueDriver once at server start.
 */
export function getQueueDriver() {
  return driverPort.get()
}

/** Clear both registries — the keyed job Map and the driver port (tests). */
export function clearQueue() {
  delete globalThis[JOBS_KEY]
  driverPort.clear()
}

/**
 * Dispatch a job by name onto the active driver. Returns whatever the driver returns
 * (the inline driver resolves once the job has run; the DB driver resolves once the
 * row is enqueued). `opts.maxAttempts` caps retries (default 1 = no retry).
 */
export function dispatch(name, payload, opts = {}) {
  const maxAttempts = Number.isFinite(opts.maxAttempts) && opts.maxAttempts > 0 ? Math.floor(opts.maxAttempts) : 1
  return getQueueDriver().enqueue({ name, payload, maxAttempts })
}

/**
 * Run a registered job once, with retry/backoff — the shared executor every driver
 * uses (the inline driver calls it directly; the DB worker calls it per claimed row).
 * Throws the last error if every attempt fails, so a driver can mark the row failed.
 *
 * `attempt` is 1-based (the count already consumed); `sleep` is injectable for tests.
 */
export async function runJob(name, payload, { maxAttempts = 1, attempt = 0, sleep = defaultSleep } = {}) {
  const handler = getJob(name)
  if (!handler) throw new Error(`vike-queue: no job registered for "${name}"`)
  let lastError
  for (let i = attempt; i < maxAttempts; i++) {
    try {
      return await handler(payload, { name, attempt: i + 1, maxAttempts })
    } catch (err) {
      lastError = err
      // Exponential backoff between in-process retries (capped); the DB driver instead
      // reschedules run_at and returns, so it doesn't hold the worker on a sleep.
      if (i + 1 < maxAttempts) await sleep(backoffMs(i + 1))
    }
  }
  throw lastError
}

/** Backoff for the Nth retry (1-based): 100ms, 200ms, 400ms ... capped at 30s. */
export function backoffMs(n) {
  return Math.min(30_000, 100 * 2 ** (n - 1))
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms))
