---
'@universal-orm/drizzle': patch
---

@universal-orm/drizzle: a `{ col: null }` equality filter now compiles to `col IS NULL` instead of `col = NULL`. The latter is `UNKNOWN` in SQL and matches no row, so the common soft-delete read `find({ deleted_at: null })` (and `count`/`update`/`delete` with the same filter) silently returned zero rows on Drizzle while working correctly on the memory and rudder adapters. The `whereOf` builder now routes a `null` condition through `isNull(col)`, matching the IS-NULL semantics the in-process matcher and the rudder adapter already use.
