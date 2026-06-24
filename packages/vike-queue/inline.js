// The INLINE driver — the zero-config default (getQueueDriver returns it when no
// driver is registered). enqueue() runs the job immediately, in process, with the
// core's retry/backoff. No table, no worker, no infra: dispatch() just runs the work.
//
// This is what keeps the dev/demo/proof experience to "it just runs" and DEFERS the
// open worker-runtime question (#151) — you only need a real driver + a worker once
// you want delivery off the request path in production.
import { runJob } from './index.js'

export function createInlineDriver() {
  return {
    async enqueue({ name, payload, maxAttempts = 1 }) {
      return runJob(name, payload, { maxAttempts })
    },
  }
}

export default createInlineDriver
