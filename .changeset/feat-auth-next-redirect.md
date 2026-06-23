---
'vike-auth': minor
---

vike-auth: return the user to where they were headed after sign-in. A guard that bounces an anonymous visitor to `/login?next=/admin` now flows that destination through the whole magic-link round-trip: the sign-in form forwards `next`, the magic link carries it, and the callback redirects there after the session opens (falling back to the site root, or `loginRedirect` for an already-signed-in visitor). The target is validated to a local path (`sanitizeNext`), so it can never become an open redirect.
