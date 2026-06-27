---
'@universal-orm/rudder': patch
---

@universal-orm/rudder: normalise timestamp reads to UTC ISO strings on the Postgres path.

universal-orm and the memory/sqlite adapters speak UTC ISO strings for timestamps (its `isoNow()`), but the porsager `pg` driver parses a `timestamp`/`timestamptz` column to a JS `Date` on read. Left as-is, the same neutral call returned a `Date` on Postgres and a string everywhere else, so an equality filter on a timestamp column (`find({ created_at: isoString })`) and any strict string comparison silently diverged on the pg path. The adapter now coerces any `Date` in a row read back from the DB to its ISO string, so reads are uniform across drivers (a no-op on sqlite, which already returns strings, and for non-timestamp columns). The instant is preserved (the column is `timestamptz`); only the JS type is normalised.

Adds a real-Postgres integration suite (`test/rudder-pg.test.js`, gated on `RUDDER_PG_URL`) that exercises the porsager `pg` driver end to end — the contract previously had no pg coverage, only sqlite/pglite. CI now runs it against a Postgres service.
