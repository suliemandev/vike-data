---
'vike-admin': minor
---

vike-admin: the agent API gains a write tier. `POST /admin/<table>.json` creates a row (`201` + the created row), `PATCH /admin/<table>/<id>.json` updates one by its primary key (partial, `200` + the updated row), and `DELETE /admin/<table>/<id>.json` deletes one (`200 { deleted: true }`).

Like the read tier, writes are not a second surface: the middleware parses the JSON body and renders the matching admin page through Vike, so the same `newData` / `editData` hooks perform the write under the same gates as the form UI. The `scope(user)` owner columns are forced onto inserts and updates/deletes key on the primary key AND the scope, so a caller can only ever write their own rows: a forged owner column is overwritten, and an id-guess for another owner's row is a `404` no-op. Only the resource's declared fields are writable (a hidden column like a password hash never is), the written-back row is projected to the resource's visible columns, and the gates match the UI (anonymous `401`, non-editable / unknown resource `404`, bad body `400`, unsupported verb `405`).

Read-only callers are unaffected. API-token auth for headless agents remains a follow-up.
