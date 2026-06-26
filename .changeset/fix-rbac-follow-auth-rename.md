---
'vike-rbac': patch
---

vike-rbac: follow a renamed auth subject in the role_user FK (#258). `role_user.user_id` referenced the literal `users`, so an app that renamed the auth subject (`VIKE_AUTH_USERS_TABLE`) broke the schema merge while the other downstream extensions (storage/push/notifications, fixed in #215) followed the rename. vike-rbac now resolves the table name via `resolveSubject().users` like those extensions. The rbac-owned FKs (`role_id`, `permission_id`) stay literal. Default resolves to `users`, so the zero-config app is byte-for-byte unchanged.
