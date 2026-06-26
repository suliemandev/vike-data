---
'vike-auth': patch
---

vike-auth: close two fail-open defaults.

1. The session cookie's `Secure` flag was inferred from `NODE_ENV !== 'production'`, so any other value (unset, `staging`, `prod`, a typo) shipped the 30-day `vike_auth_session` cookie without `; Secure`, letting it travel over plain HTTP. `secure` now defaults to `true` in `createAuthMiddleware` and the default wiring only opts out when it positively detects the local dev server (`NODE_ENV === 'development'`, which Vite/Vike sets). Forgetting `NODE_ENV=production` now fails closed (Secure stays on).

2. `isExpired` returned `false` for an unparseable/null expiry (`NaN <= base` is `false`), treating a corrupted row or custom-store value as never-expiring. It now treats a non-finite timestamp as already expired.
