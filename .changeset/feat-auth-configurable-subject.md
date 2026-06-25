---
'vike-auth': minor
---

vike-auth: make the authenticated subject + its table names configurable (#208). By default vike-auth still owns subject `User` over `users` / `sessions` / `login_tokens`, byte-for-byte the previous behaviour. An app can now rename them through a single env-based knob (`VIKE_AUTH_SUBJECT` / `VIKE_AUTH_USERS_TABLE` / `VIKE_AUTH_SESSIONS_TABLE` / `VIKE_AUTH_LOGIN_TOKENS_TABLE`), read identically by both the build-time schema (now a computed `schemas` factory at `vike-auth/schemas`) and the runtime store, so the two can never disagree. The FK column stays `user_id`; only its target table follows the rename. Single instance only; multi-instance guards and downstream subject binding remain later phases (#207).
