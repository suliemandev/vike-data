---
'vike-storage': minor
---

vike-storage: a new file storage / uploads extension (server core). A swappable storage port (`setStorageProvider` / `getStorageProvider`, contract `put` / `get` / `delete` / `url`) with a built-in in-memory dev default that keeps bytes for the dev run and serves them back through `GET /uploads/:key`; an `uploads` metadata table (id, user_id, storage_key, filename, mime, size) it owns and contributes to the cumulative schema; and a multipart upload endpoint. `POST /uploads` and `DELETE /uploads/:id` are bound to the signed-in user (vike-auth session), with the delete scoped to the owner so guessing another user's id deletes nothing; `GET /uploads/:key` is a capability URL (unguessable key). Self-installs vike-schema + vike-auth, so installing it adds the table and the `/uploads` routes with no app wiring. The per-framework upload control and the vike-admin `file` widget land in a follow-up, like vike-push's client split.
