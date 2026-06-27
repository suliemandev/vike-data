---
'@vike-data/universal-schema': patch
---

universal-schema: emit Prisma timestamp columns as `@db.Timestamptz(3)` so UTC instants round-trip.

Prisma maps a bare `DateTime` to PostgreSQL's native `timestamp(3)` WITHOUT time zone. universal-orm writes UTC ISO instants with a `Z` (its `isoNow()`, e.g. `2020-01-01T00:00:00.000Z`); stored in a no-tz column the offset is dropped on the round-trip and the value reads back shifted by the server's local offset, so a freshly-issued token's `expires_at` can read as already expired. This is the same bug class the Drizzle compiler already avoids via `withTimezone: true`. The Prisma compiler now adds the `@db.Timestamptz(3)` native-type attribute to every timestamp column, preserving the instant.
