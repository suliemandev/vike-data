---
'vike-auth': minor
---

vike-auth: redirect an already-signed-in visitor away from `/login`. The shipped `/login` page now has a guard that bounces a signed-in user to the app's post-login home, set with the new `loginRedirect` config key (default `/`) — `loginRedirect: '/admin'`. Works on first load (server-side 302) and on client-side navigation.
