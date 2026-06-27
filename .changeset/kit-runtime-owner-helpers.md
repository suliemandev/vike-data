---
'@vike-data/kit': minor
'vike-storage': patch
'vike-notifications': patch
'vike-push': patch
---

kit: add the RUNTIME half of the owner contract (#250) + two shared middleware helpers, so the three owned-row extensions stop copy-pasting them.

- `resolveOwnerColumn(value, defaultColumn = DEFAULT_OWNER_COLUMN)` — the request-time column reader (raw `VIKE_<X>_OWNER_COLUMN` env value, trimmed, defaulting to `user_id` when blank).
- `resolveOwnerId(user, { from, subjectTable, adapter })` — the request-time owner-id resolver and complement to the build-time `resolveOwner`: the user is the owner by default (owner id = `user.id`); a `from` field (e.g. `current_organization_id`) loads the subject row and reads it, returning null when there's no owner so the caller answers 403.
- `jsonResponse(status, body)` and `readJsonSafe(request)` — the shared `application/json` response + tolerant body-parse helpers the extension middlewares use.

All stay pure (no env, no globals — the caller passes the already-read env value + an injected adapter), the same character as `resolveOwner`, so kit keeps its zero dependencies.

vike-storage / vike-notifications / vike-push: internal refactor only — each now delegates its `ownerColumn()` / `resolveOwnerId()` and its `json()` / `readJson()` helpers to the shared kit ones via a thin local wrapper that binds the package's own env var + subject table. No behaviour change; the byte-for-byte single-owner default path is preserved.
