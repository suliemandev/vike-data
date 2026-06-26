// The DATABASE driver — persists each dispatched job as a row in the `jobs` table
// (schema.js) through the app's universal-orm adapter, so work survives a restart and
// can run out of process. enqueue() only INSERTs; a worker calls work() to claim and
// run pending rows. That split is what moves delivery off the request path.
//
// THE OPEN WORKER-RUNTIME QUESTION (#151) lives here: something has to call work().
// For now it is exposed as a plain function a caller drives (a `vike-queue work` CLI,
// a cron/HTTP-pull endpoint that drains N per invocation, or a test). The inline
// driver remains the zero-worker dev default; this driver is opt-in via setQueueDriver.
//
// Claiming is ATOMIC: a row is moved `pending` -> `running` with a compare-and-swap
// (`update WHERE id=? AND status='pending'`) and only the worker whose update matched a
// row runs the handler, so two concurrent workers / overlapping drains never run the same
// job twice. A `running` row left behind by a crashed worker is reclaimed after a
// visibility timeout (see work()), so crash recovery is preserved. On a real ORM the same
// filtered UPDATE is atomic at the DB level (SQLite: pair with BEGIN IMMEDIATE + WAL).
import { randomUUID } from 'node:crypto'
import { getAdapter } from '@universal-orm/core'
import { runJob, backoffMs } from './index.js'

const TABLE = 'jobs'

// A `running` row whose claim is older than this is assumed abandoned (the worker crashed)
// and returned to `pending` to be retried. It MUST exceed your longest handler, or a job
// still running could be reclaimed and run a second time. Override per driver.
const DEFAULT_VISIBILITY_TIMEOUT_MS = 5 * 60 * 1000

function requireAdapter() {
  const adapter = getAdapter()
  if (!adapter) {
    throw new Error('vike-queue database driver: no universal-orm adapter registered (call setAdapter() first)')
  }
  return adapter
}

export function createDatabaseDriver({
  now = () => new Date().toISOString(),
  visibilityTimeoutMs = DEFAULT_VISIBILITY_TIMEOUT_MS,
} = {}) {
  return {
    // Enqueue only. The row is immediately eligible (run_at = now); a worker runs it.
    async enqueue({ name, payload, maxAttempts = 1 }) {
      const adapter = requireAdapter()
      const ts = now()
      const row = {
        id: randomUUID(),
        name,
        payload: JSON.stringify(payload ?? null),
        status: 'pending',
        attempts: 0,
        max_attempts: maxAttempts,
        run_at: ts,
        failed_at: null,
        last_error: null,
        created_at: ts,
        updated_at: ts,
      }
      await adapter.insert(TABLE, row)
      return { id: row.id, status: 'pending' }
    },

    // Drain up to `max` ready jobs (status pending, run_at <= now). One attempt per row
    // per pass: on success -> done; on failure -> reschedule with backoff, or mark failed
    // once attempts hit max_attempts. Returns a small summary for a caller/CLI to log.
    //
    // `max` is a PROCESSING cap, not a fetch cap: the adapter filters are equality + `in`
    // only, so the whole pending set is read and run_at <= now is applied in JS. Fine for
    // the spike / a single drainer; a production driver would push the predicate + LIMIT
    // into the query. Compare run_at via Date.parse (not string order) so a custom `now`
    // format can't silently break ordering.
    async work({ max = 100 } = {}) {
      const adapter = requireAdapter()
      const ts = now()
      const nowMs = Date.parse(ts)

      // Reclaim zombies first: a `running` row last touched before the visibility window
      // is assumed to belong to a crashed worker and returned to `pending` so it retries.
      // The CAS on `status: 'running'` keeps two drains from double-reclaiming. attempts is
      // left as-is (it was incremented at claim), so a job can't exceed its max via crashes.
      const staleBefore = nowMs - visibilityTimeoutMs
      const running = await adapter.find(TABLE, { status: 'running' })
      for (const z of running) {
        if (Date.parse(z.updated_at) <= staleBefore) {
          await adapter.update(TABLE, { id: z.id, status: 'running' }, { status: 'pending', updated_at: now() })
        }
      }

      const pending = await adapter.find(TABLE, { status: 'pending' })
      const ready = pending.filter((j) => !j.run_at || Date.parse(j.run_at) <= nowMs).slice(0, max)

      let processed = 0
      let done = 0
      let failed = 0
      let rescheduled = 0
      for (const job of ready) {
        const attempt = job.attempts || 0
        const maxAttempts = job.max_attempts || 1

        // A reclaimed job that already used all its attempts (it crashed on the last one)
        // must fail, not run again — guard before claiming so it can't exceed max_attempts.
        if (attempt >= maxAttempts) {
          const [marked] = await adapter.update(
            TABLE,
            { id: job.id, status: 'pending' },
            { status: 'failed', failed_at: now(), last_error: job.last_error ?? 'max attempts exceeded', updated_at: now() },
          )
          if (marked) { processed++; failed++ }
          continue
        }

        const attempts = attempt + 1
        // Atomic claim: flip pending -> running in one compare-and-swap and bump attempts.
        // Only the worker whose update matched the still-`pending` row proceeds; a racer
        // matches no row (`[claimed]` is undefined) and skips, so the handler runs once.
        const [claimed] = await adapter.update(
          TABLE,
          { id: job.id, status: 'pending' },
          { status: 'running', attempts, updated_at: now() },
        )
        if (!claimed) continue // lost the race to another worker

        processed++
        try {
          // maxAttempts:attempts, attempt:attempt -> runJob runs the handler exactly once
          // (no in-process retry loop); retries are driven by rescheduling here.
          await runJob(job.name, parsePayload(job.payload), { maxAttempts: attempts, attempt })
          await adapter.update(TABLE, { id: job.id }, { status: 'done', updated_at: now() })
          done++
        } catch (err) {
          const message = String(err?.message ?? err)
          if (attempts >= maxAttempts) {
            await adapter.update(TABLE, { id: job.id }, {
              status: 'failed', failed_at: now(), last_error: message, updated_at: now(),
            })
            failed++
          } else {
            // Back to `pending` (so a later drain re-claims it) once the backoff elapses.
            const runAt = new Date(Date.parse(now()) + backoffMs(attempts)).toISOString()
            await adapter.update(TABLE, { id: job.id }, {
              status: 'pending', run_at: runAt, last_error: message, updated_at: now(),
            })
            rescheduled++
          }
        }
      }
      return { processed, done, failed, rescheduled }
    },
  }
}

function parsePayload(raw) {
  try {
    return JSON.parse(raw ?? 'null')
  } catch {
    return null
  }
}

export default createDatabaseDriver
