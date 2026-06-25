---
'vike-push': patch
'vike-notifications': patch
'vike-storage': patch
---

fix: follow vike-auth's configurable subject table in the downstream FK targets. vike-auth's subject table is renameable (`VIKE_AUTH_USERS_TABLE`), but the packages that key into it still hardcoded `references('users.id')`, so an app that renamed the subject AND installed a channel package emitted a foreign key to a `users` table that was never created (a dangling FK / broken migration), and vike-notifications hydrated a bare user id from the wrong table. The `push_subscriptions`, `notifications`, and `uploads` schemas now point their `user_id` FK at the resolved subject table (read from the same single source vike-auth's own schema and store use), and vike-notifications' id hydration reads it too. The FK column stays `user_id`; only its target follows the rename. With no override set the emitted DDL is byte-for-byte unchanged.
