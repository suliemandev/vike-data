# vike-storage

File storage / uploads for vike-data. A swappable storage **port** for the bytes, an `uploads` **metadata table**, and a multipart **upload endpoint** bound to the signed-in user. Stateful, modeled on vike-push.

Install it and you get the `uploads` table plus the `/uploads` routes with no app wiring (it self-installs vike-schema + vike-auth).

## The storage port

The bytes live behind a provider you can swap:

```js
import { setStorageProvider } from 'vike-storage'

setStorageProvider({
  async put(key, bytes, meta) { /* write to S3 / R2 / disk */ },
  async get(key) { /* -> { bytes, meta } | null */ },
  async delete(key) { /* remove */ },
  url: (key) => `https://cdn.example/${key}`,
})
```

With no provider registered, a built-in **in-memory store** keeps the bytes for the dev run (cached on `globalThis`, so they survive across requests) and serves them back through `GET /uploads/:key`. Zero infra, so the seam is provable before you wire a real bucket. A real provider (S3 / R2 / disk) is the swappable piece; its `url(key)` can return a direct or presigned URL.

## Storing a file from server code

```js
import { storeUpload } from 'vike-storage'

const { id, key, url } = await storeUpload(user.id, { filename, mime, bytes })
```

`storeUpload` writes the bytes through the provider under a fresh unguessable key and records a metadata row (`id`, `user_id`, `storage_key`, `filename`, `mime`, `size`).

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `POST /uploads` | signed-in user | multipart `file` field; stores it, returns `{ key, url, id, filename, mime, size }` |
| `GET /uploads/:key` | none (capability URL) | serves the stored bytes; the key is an unguessable uuid |
| `DELETE /uploads/:id` | owner only | removes the caller's own upload (bytes + row); idempotent, no existence oracle |

`POST`/`DELETE` are bound to the signed-in user (vike-auth session), so a client can only upload as itself and delete only its own files. `DELETE` is scoped to the owner, so guessing another user's id deletes nothing.

## Not yet (follow-ups)

- The per-framework upload control (`vike-storage/react`, `/vue`) and the vike-admin `file` widget, so an `.as('file')` column renders as an uploader.
- Real signed URLs / private buckets / per-object access control.
- Image transforms / thumbnails.

`GET` is a capability URL (unguessable key, no per-object ACL) for now; private buckets are a follow-up.
