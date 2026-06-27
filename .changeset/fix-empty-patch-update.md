---
'@universal-orm/drizzle': patch
'@universal-orm/rudder': patch
---

universal-orm: an empty-patch `update` is now a no-op returning the matched rows, instead of throwing.

`update(table, filter, {})` (an empty patch) threw on both real-DB adapters: Drizzle's `.set({})` throws "No values to set" and Rudder's `updateAll({})` throws "compileUpdate called with no columns to set". The in-memory reference adapter treats the same call as a no-op (`Object.assign(r, {})`) and returns the matched rows unchanged, so a caller building a conditional patch that resolves to empty worked in dev (memory) and crashed only against a real database. Both adapters now short-circuit an empty patch: they select the matched rows and return them unchanged (returning `[]` when the filter matches nothing), matching memory.
