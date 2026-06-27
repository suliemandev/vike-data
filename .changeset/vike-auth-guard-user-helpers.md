---
'vike-auth': minor
'vike-storage': patch
'vike-notifications': patch
---

vike-auth: add two by-name guard-resolution helpers on `vike-auth/server`, so the downstream owned-row extensions stop re-deriving them.

- `resolveGuardedUser(request, guardName)` — resolve a request's user from the named guard's session cookie + subject, or from the default subject when the name is empty / `'default'` / an unregistered guard.
- `resolveGuardSubjectTable(guardName)` — the subject table that guard's user lives in (its own, or the default `users`), for loading the full subject row + bare-id hydration.

Both take the guard NAME (the app's already-read env value), so vike-auth stays env-free. They are the natural home for the `name -> guard -> user/table` step that vike-storage's `storageGuard` and vike-notifications' `notificationsGuard` (#278 / #279 / #207 P3) had each copy-pasted; these helpers couldn't live in `@vike-data/kit` (the prior dedup, #309) because kit must not depend on vike-auth.

vike-storage / vike-notifications: internal refactor only — `resolveUploadUser`/`resolveFeedUser`, `userSubjectTable`, and notifications' `notifiableTable` now delegate to the shared vike-auth helpers via a thin wrapper binding each package's own `VIKE_*_GUARD`. No behaviour change; the byte-for-byte default + named-guard paths are preserved.
