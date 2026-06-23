---
'vike-auth': patch
---

vike-auth: keep the signed-in user resolved across client-side navigation. `onCreatePageContext` is isomorphic by default, so on a client-side navigation Vike ran it on the client — where the HttpOnly session cookie is unreadable — and `user` came back null: `useUser()` read signed-out after any client-side nav, and the `/login` guard failed to redirect an already-signed-in user who arrived via a nav link (only full-page loads redirected). Pinning the hook's env to `{ server: true }` makes Vike round-trip to the server on client-side navigation and re-resolve `user`, so the guard and `useUser()` are correct on both full loads and client-side navigation.
