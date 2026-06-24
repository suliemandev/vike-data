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
// Claiming is intentionally simple for the spike (read pending, run, update): safe for
// a single worker. Concurrency-safe claiming (row locking / BEGIN IMMEDIATE + WAL) is a
// known follow-up, not needed for dev or a single drainer.
import { randomUUID } from 'node:crypto'
import { getAdapter } from '@universal-orm/core'
import { runJob, backoffMs } from './index.js'

const TABLE = 'jobs'

function requireAdapter() {
  const adapter = getAdapter()
  if (!adapter) {
    throw new Error('vike-queue database driver: no universal-orm adapter registered (call setAdapter() first)')
  }
  return adapter
}

export function createDatabaseDriver({ now = () => new Date().toISOString() } = {}) {
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
      const pending = await adapter.find(TABLE, { status: 'pending' })
      const ready = pending.filter((j) => !j.run_at || Date.parse(j.run_at) <= nowMs).slice(0, max)

      let done = 0
      let failed = 0
      let rescheduled = 0
      for (const job of ready) {
        const attempt = job.attempts || 0
        const maxAttempts = job.max_attempts || 1
        try {
          // maxAttempts:attempt+1, attempt:attempt -> runJob runs the handler exactly
          // once (no in-process retry loop); retries are driven by rescheduling here.
          await runJob(job.name, parsePayload(job.payload), { maxAttempts: attempt + 1, attempt })
          await adapter.update(TABLE, { id: job.id }, { status: 'done', attempts: attempt + 1, updated_at: now() })
          done++
        } catch (err) {
          const attempts = attempt + 1
          const message = String(err?.message ?? err)
          if (attempts >= maxAttempts) {
            await adapter.update(TABLE, { id: job.id }, {
              status: 'failed', attempts, failed_at: now(), last_error: message, updated_at: now(),
            })
            failed++
          } else {
            const runAt = new Date(Date.parse(now()) + backoffMs(attempts)).toISOString()
            await adapter.update(TABLE, { id: job.id }, {
              attempts, run_at: runAt, last_error: message, updated_at: now(),
            })
            rescheduled++
          }
        }
      }
      return { processed: ready.length, done, failed, rescheduled }
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
