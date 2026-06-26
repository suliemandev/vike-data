---
'vike-queue': minor
---

vike-queue: claim jobs atomically so concurrent workers can't run the same job twice.

The database driver's `work()` read a row as `pending`, ran its handler, then marked it `done` — with no atomic claim, so two workers (or two overlapping drains) could both read job J as pending and both invoke its handler (the email sends twice, the charge runs twice), and concurrent `attempts`/`run_at` updates clobbered each other. The only safe deployment was a single drainer.

`work()` now claims each row with a compare-and-swap (`update ... WHERE id=? AND status='pending'`, moving it to `running` and bumping `attempts`) and runs the handler only if the update matched a row, so a job runs exactly once across concurrent workers. A `running` row abandoned by a crashed worker is returned to `pending` after a visibility timeout (`visibilityTimeoutMs`, default 5 min), preserving crash recovery; a reclaimed job that already exhausted its attempts is marked `failed` rather than rerun. On a real ORM the filtered UPDATE is atomic at the DB level (pair with `BEGIN IMMEDIATE` + WAL on SQLite).
