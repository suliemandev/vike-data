---
'vike-admin': minor
---

vike-admin: foreign-key fields render as selects. A form field whose schema column references another table (e.g. `sessions.user_id -> users.id`) becomes a `<select>` of the referenced rows, labeled by the target resource's `recordTitle` (else a schema default) instead of a raw key. List cells resolve foreign keys to the same title. The create and edit forms now share a single `FormFields` renderer (text / checkbox / select).
