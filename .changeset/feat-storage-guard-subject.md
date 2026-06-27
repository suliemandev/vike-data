---
'vike-storage': minor
'vike-auth': minor
---

vike-storage: bind uploads to a non-default auth subject with `storageGuard` (the downstream "which subject" seam, #207 P3). An app that runs vike-auth's named guards (#267) can now own uploads by a guard other than the default user: set `storageGuard: '<name>'` and the `uploads.user_id` FK target follows that guard's subject table (e.g. `admins` instead of `users`), while the upload endpoint resolves the owner from that guard's session cookie (via the new `VIKE_STORAGE_GUARD` runtime knob). The schema is now a computed contribution parameterized by the resolved config, the exact shape vike-stripe's `subscriptionSchemas({ segment })` uses; the FK column stays `user_id`, only its target moves. Unset = the default `users` subject, byte-for-byte unchanged, so the common single-subject app is untouched. The build-time `storageGuard` and the runtime `VIKE_STORAGE_GUARD` mirror vike-stripe's `segment`/`BILLING_SEGMENT` split.

vike-auth: add `resolveGuardUser(request, guard)` / `resolveGuardUserFromCookie(cookieHeader, guard)` to `vike-auth/server` — the guard-aware twin of `resolveSessionUser`, resolving the user for a specific guard descriptor (its own cookie + subject tables) outside the render lifecycle. Passing the default guard is exactly `resolveSessionUser`; passing a named guard binds resolution to that audience. This is the server seam a downstream extension uses to own rows by a non-default subject (vike-storage above).
