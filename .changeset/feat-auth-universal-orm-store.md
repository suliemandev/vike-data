---
'vike-auth': minor
---

vike-auth: persist users/sessions/login_tokens through the app's universal-orm adapter when one is registered. The default auth store now auto-detects a registered `@universal-orm/core` adapter and reads/writes through it — so a user who signs in via the magic link lands in the same `users` table the rest of the app sees (e.g. the admin panel lists the new signup). With no adapter registered it falls back to the previous private in-memory store, so installing vike-auth standalone still works with no database. No app wiring needed; the choice is made per operation via `getAdapter()`. New `createStore()` export is the default; `createMemoryStore()` remains for an explicit in-memory store.
