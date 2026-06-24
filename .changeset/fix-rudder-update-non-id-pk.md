---
'@universal-orm/rudder': patch
---

@universal-orm/rudder: `update` now returns the changed rows for a table whose primary key is not literally `id` (e.g. `token`, or a composite key). Rudder's bulk `updateAll` returns only a row count, so the adapter previously re-read the rows by a hard-coded `id` and returned `[]` whenever the PK was not `id` — even though the write had succeeded. It now reads the matched rows first and returns them with the patch applied (the same post-state the in-memory adapter returns), which needs no primary key and is correct for any PK shape including composite. The unused `{ primaryKey }` option on `createRudderAdapter` is removed.
