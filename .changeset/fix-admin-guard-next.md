---
'vike-admin': patch
---

vike-admin: the `/admin/*` guard now bounces an anonymous request to `/login?next=<the path>` instead of a bare `/login`, so after signing in the user lands back on the admin page they were trying to reach (powered by vike-auth's `next` support).
