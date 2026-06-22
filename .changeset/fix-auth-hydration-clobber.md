---
'vike-auth': patch
---

vike-auth: fix a signed-in page flipping to signed-out right after hydration. `onCreatePageContext` is isomorphic, so Vike also ran it on the client, where the session cookie is unreadable (HttpOnly, and `pageContext.headers` does not exist client-side); it resolved `user` to null and clobbered the value `passToClient` had already delivered. The hook now bails on the client (`isClientSide`) and keeps what the server resolved. Client-side navigation is unaffected: the value is re-resolved on the server for each page.
