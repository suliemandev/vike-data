---
'@vike-data/vike-admin': patch
---

vike-admin: the HTML list and edit pages now project rows to the resource's visible columns (plus the primary key) before returning them, so hidden columns no longer reach the client. Previously `listData` returned the full `rows` and `editData` the full `values`, which vike-react serializes verbatim into the client hydration payload — leaking columns the admin hides by convention (a `password_hash`, an unlisted secret), including to a non-admin user managing their own row-scoped record. The JSON agent API already projected via `projectRow`; that allow-list is now shared (`project.js`) and applied on the HTML path too, so the two surfaces can't drift.
