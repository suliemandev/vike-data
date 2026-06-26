# vike-queue

A background-job seam: dispatch work onto a queue and let a driver decide where and when it runs. The base layer other extensions (vike-mail, ...) queue work onto, in the same shape as universal-orm (a contract + a swappable runtime registration).

## Usage

```js
import { registerJob, dispatch } from 'vike-queue'

// register a handler (once, at import / server start)
registerJob('resize-avatar', async ({ userId }) => { /* ... */ })

// dispatch it (anywhere)
await dispatch('resize-avatar', { userId: 'u-1' }, { maxAttempts: 3 })
```

With no driver registered, `dispatch` runs the job inline (in process, immediately). That is the zero-config dev default, the queue equivalent of the memory ORM adapter, and it sidesteps needing a worker.

## Drivers

```js
import { setQueueDriver } from 'vike-queue'
import { createDatabaseDriver } from 'vike-queue/database'

setQueueDriver(createDatabaseDriver()) // persists jobs to the `jobs` table (universal-orm)
```

- **inline** (`vike-queue/inline`): the default. Runs the job now, with retry/backoff.
- **database** (`vike-queue/database`): `enqueue` inserts a row in the `jobs` table; a worker calls `work()` to claim and run pending rows, rescheduling failures with backoff and marking them failed at `maxAttempts`.

Install the extension (`extends: ['import:vike-queue/config:default']`) to contribute the `jobs` table to the composed schema; an app that only uses the inline driver still gets the table and simply leaves it empty.

## Open question: where the worker runs

The database (and any production) driver needs a worker, but Vike apps are request/response. The worker model (a `vike-queue work` CLI, a serverless cron/HTTP-pull drain, or delegating to a broker's native worker) is deliberately left open; the inline default means dev and the demo need no worker. See issue #151.

## Concurrent workers

`work()` claims each row **atomically** — a `pending` row is moved to `running` with a compare-and-swap (`update ... WHERE id=? AND status='pending'`) and only the worker whose update matched the row runs the handler, so two workers (or two overlapping drains) never run the same job twice. On a real ORM that filtered `UPDATE` is atomic at the DB level (on SQLite, pair it with `BEGIN IMMEDIATE` + WAL). A `running` row abandoned by a crashed worker is returned to `pending` after a **visibility timeout** (`visibilityTimeoutMs`, default 5 min) so it retries; set it longer than your slowest handler, or a still-running job could be reclaimed and run twice.

## Retries

`dispatch(name, payload, { maxAttempts })` caps attempts (default 1 = no retry). Backoff grows 100ms, 200ms, 400ms ... capped at 30s. The inline driver retries in process; the database driver reschedules `run_at`.
