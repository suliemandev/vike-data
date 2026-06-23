---
'@universal-orm/rudder': minor
'vike-rudder': minor
---

Rudder as a runtime backend (#75). Two new packages complete the Rudder data vertical (the schema half already lands via the `rudder` codegen target):

- `@universal-orm/rudder` runs the neutral universal-orm operations against a `@rudderjs/database` `NativeAdapter` (Rudder's query builder). Rudder speaks snake_case DB names directly, so neutral keys pass straight through with no name translation and the adapter needs only the connection. Bulk writes return a count, so `update` / `upsert` re-read to honour the "return the row(s)" contract.
- `vike-rudder` is the one-line binding: `registerRudder({ driver, url })` builds the connection via `NativeAdapter.make` (no Rudder framework bootstrap) and registers it as the adapter, so every extension writes to a Rudder database with no manual wiring. The twin of `vike-drizzle`.

Proven end to end: vike-stripe INSERTs/UPSERTs a real row through the binding on in-memory sqlite. The app gains `VIKE_DATA_ORM=rudder` runtime wiring alongside drizzle/prisma.
