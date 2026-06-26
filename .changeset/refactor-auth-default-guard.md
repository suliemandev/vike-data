---
'vike-auth': minor
---

vike-auth: unify the default subject as the "default guard" (#276). The primary,
env-configured subject is now expressed through the same descriptor shape as a named guard,
in the same registry, built by one shared descriptor builder — its specialness (the bare
`vike_auth_session` cookie, the `/auth` base, `pageContext.user`) is just data on its
descriptor, not a separate code path. `instance.js` becomes a thin alias over
`getDefaultGuard().instance`.

New programmatic surface: `getDefaultGuard()`, `getAllGuards()` (the default guard followed
by the named ones, as uniform descriptors — the enumeration seam the downstream "which
subject" work will bind through), and `getGuard('default')`. `'default'` is now a reserved
guard name (`defineGuard('default', ...)` throws; configure the default via env instead).

App-facing surface is unchanged: a single-subject app still configures via env (or nothing),
additional audiences via `defineGuard`. The default path stays byte-for-byte (`/login`,
`/auth/*`, `vike_auth_session`, `pageContext.user`).
