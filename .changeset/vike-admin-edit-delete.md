---
'vike-admin': minor
---

vike-admin: complete the CRUD loop with detail/edit + delete. `/admin/:table/:id` renders a form pre-filled with the row that UPDATEs on save and DELETEs via a Delete control, gated by `canEdit`; the list gains an Edit link per row. The static `/new` route keeps precedence over the `@id` param, and form-to-row coercion is shared between create and edit.
