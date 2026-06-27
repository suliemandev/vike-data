---
'@vike-data/universal-schema': patch
---

universal-schema: emit Drizzle timestamp columns as `timestamptz` so UTC instants round-trip faithfully.

The Drizzle codegen rendered every timestamp as a bare `timestamp('col', { mode: 'string' })` (Postgres `timestamp WITHOUT time zone`). universal-orm writes UTC ISO instants (its `isoNow()`, e.g. `2020-01-01T00:00:00.000Z`), and a no-timezone column drops the offset on the round-trip, so the value reads back shifted by the server's local offset. In practice a freshly issued vike-auth magic-link token (a `login_tokens.expires_at` a few minutes in the future) read back as already in the past, so `redeemMagicLink` failed every sign-in with `expired-token` on a real database. The column now renders as `timestamp('col', { withTimezone: true, mode: 'string' })` (`timestamptz`), the correct type for an instant, which preserves the moment exactly. Re-run `db:generate` to refresh migrations; this is a schema-output change (new migrations cast the affected columns to `timestamptz`).
