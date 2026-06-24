---
'vike-admin': patch
---

vike-admin: a foreign-key `<select>` (and the list's FK label map) no longer enumerates the whole referenced table for a row-scoped user. The lookup is now bounded by the target resource's own `scope(user)`, the same filter that bounds its own list, so a scoped non-admin only sees in-scope rows in an FK dropdown (and never serializes out-of-scope titles such as other users' emails into the page view-model). A foreign key whose target has no registered resource or no scope is unbounded as before, so this is purely additive.
