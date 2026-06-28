---
'@universal-orm/rudder': patch
---

@universal-orm/rudder: return the real post-write rows from `update` / `upsert` via the new RETURNING bulk terminals.

`update` previously read the matched rows, then echoed the patch over that pre-write snapshot (`{ ...row, ...patch }`), which hid any value the DB computed differently from the input — a generated column, a trigger, a coercion (#319). `upsert` re-read the row by the input conflict key, which was `undefined` when a DB default filled an omitted conflict column, so it returned `null` (#320).

Both now use `@rudderjs/database`'s `updateAllReturning` / `upsertReturning` (>=1.6.0), which run the write with `RETURNING *` and hand back the actual stored rows — DB defaults, coercion, and generated/trigger columns all reflected, for any primary-key shape, with no re-read. `update` keeps the empty-patch no-op; `upsert` falls back to a read-by-key only for the `ON CONFLICT DO NOTHING` (empty update set) case, which returns no row. Adds generated-column and default-filled-conflict-key regression tests to the SQLite and real-Postgres suites. The `@rudderjs/database` peer is now `>=1.6.0`.
