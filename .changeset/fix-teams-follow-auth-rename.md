---
'vike-teams': patch
---

vike-teams: follow a renamed auth subject in its FK targets (#256). vike-teams references auth's subject table from `organizations.owner_id`, `memberships.user_id`, and the `extendSchema` that adds `current_organization_id`. These were hardcoded to the literal `users`, so an app that renamed the auth subject (`VIKE_AUTH_USERS_TABLE`) broke the schema merge while the other downstream extensions (storage/push/notifications, fixed in #215) followed the rename. vike-teams now resolves the table name via `resolveSubject().users`, the same as those extensions. Default resolves to `users`, so the zero-config app is byte-for-byte unchanged.
