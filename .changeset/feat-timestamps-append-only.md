---
'@vike-data/universal-schema': minor
---

`timestamps({ updatedAt: false })` for append-only rows (#26). The `timestamps()` helper baked in a mutable-row assumption: it always added `updated_at`, which is wrong for an immutable / append-only row (an event log, a charge record) that is recorded once and never updated. The new option omits `updated_at` and keeps `created_at` only; the default (both columns) is unchanged. `vike-stripe`'s immutable `payments` table now uses it instead of hand-rolling `created_at`.
