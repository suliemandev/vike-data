---
'vike-rbac': minor
---

vike-rbac: collapse the Telefunc seam to ONE transport for dev and prod (#128). Previously the seam needed two wirings — a dev Vite plugin (`vike-rbac/telefunc-plugin`) AND a prod universal middleware — because telefunc's dev Vite plugin auto-installs a connect middleware on the literal `/_telefunc` that calls telefunc() with no context and runs before Vike's onion, so a single universal middleware could never provide context under `vite dev`.

Telefunc's now-configurable `telefuncUrl` makes the bypass clean: the seam relocates its endpoint off `/_telefunc` (telefunc's auto dev-middleware only intercepts that literal path), so the request falls through to ONE universal middleware (`vike-rbac/telefunc-middleware`) in both dev and prod, where the signed-in, role-enriched user is put on the Telefunc context. The middleware points telefunc's server at the relocated url; a new `vike-rbac/telefunc-client` entry points the browser client there.

Wiring is now `middleware: ['import:vike-rbac/telefunc-middleware:default']` plus a one-line client entry (`import 'vike-rbac/telefunc-client'`), with no Vite plugin. BREAKING (opt-in seam): the `vike-rbac/telefunc-plugin` export is removed; drop it from `vite.config` and add the client entry. New exports: `./telefunc-client`, `./telefunc-url`.
