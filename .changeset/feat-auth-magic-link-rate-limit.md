---
'vike-auth': minor
---

vike-auth: rate-limit magic-link issuance and stop `login_tokens` from flooding.

`POST /auth/request` previously issued a token and (attempted to) send mail for any syntactically valid email with no throttle and no cap, letting an attacker email-bomb a victim address and insert unbounded `login_tokens` rows. `requestMagicLink` now spaces links to the same email by a cooldown (`magicLinkCooldownMs`, default 60s) and caps the number of concurrently-live links per email (`maxActiveMagicLinks`, default 3); a throttled request returns the same neutral notice as success, so it is not an existence/timing oracle. Stale rows are purged on each request and `redeemMagicLink` now deletes the token on consume (delete-on-consume), so a normal request -> redeem leaves nothing behind and the table cannot grow unbounded.

The limit state is the durable `login_tokens` rows, so it holds across horizontally-scaled instances. Per-IP / cross-email throttling is intentionally left to the edge (WAF / shared limiter), where in-process counters would be incorrect under scale-out. Two new `Store` methods (`findLoginTokensByEmail`, `deleteLoginToken`) are required of custom stores.
