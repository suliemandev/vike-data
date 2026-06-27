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

The stored mime is browser-supplied, so `GET` never trusts it to render arbitrary content from your origin: it sends `X-Content-Type-Options: nosniff` always, serves a small allowlist of inert image types (`png`, `jpeg`, `gif`, `webp`, `avif`) `inline`, and forces everything else (including `text/html` and script-capable `image/svg+xml`) to `application/octet-stream` with `Content-Disposition: attachment` so the browser downloads instead of executing it. For untrusted uploads, prefer serving from a separate origin/CDN as defense in depth.

**Key validation.** A storage key is always a UUID this package minted, so `readUpload` (and therefore `GET`) rejects anything else before it reaches the provider — a traversal payload like `..%2f..%2fetc%2fpasswd` returns `404` and the provider is never asked. A disk/S3 provider must still reject keys containing path separators or `..` as defense in depth; the framework guards the key it receives, the provider guards the path it builds.

**Upload size.** `POST` caps a single upload at `getMaxUploadBytes()` (default 10 MiB; set with `setMaxUploadBytes(n)` or the `VIKE_STORAGE_MAX_UPLOAD_BYTES` env var). An over-size `Content-Length` is rejected with `413` before the body is buffered; a missing/understated `Content-Length` is caught by re-checking the parsed file size. A hard streaming cap against a *lying* `Content-Length` belongs at your reverse proxy's body-size limit.

## Which subject owns uploads (`storageGuard`)

By default uploads are owned by the default vike-auth subject (`users`). An app running [named guards](../vike-auth/README.md#named-guards-multi-instance) can own uploads by a different audience instead — bind storage to a guard and a file is owned by that guard's subject, resolved from that guard's session cookie:

```js
// +config.js — build-time: the uploads.user_id FK targets the admin guard's subject (`admins`)
storageGuard: 'admin',
```
```bash
# runtime: the /uploads endpoint resolves the owner from the admin session cookie
VIKE_STORAGE_GUARD=admin
```

Two knobs, one per half (schema vs request), the same config/env split vike-stripe uses for `segment`/`BILLING_SEGMENT`; keep them pointed at the same guard. The FK **column** stays `user_id`, only its **target table** follows the guard. Leave both unset and storage owns uploads by the default `users` subject, byte-for-byte. An unknown guard name degrades to the default subject rather than minting an FK to a table no guard owns. See the [two-audience example](../../examples/two-audience) for a worked staff-owned upload.

## Owned by a team, not a user (`storageOwner`, #250)

`storageGuard` (above) picks **which user** owns a file. `storageOwner` is the orthogonal axis: it picks **what kind of owner** — let a file belong to an *organization* (so every member of the org shares it), not a single user. This is the same move [vike-stripe's `segment`](../vike-stripe/README.md) makes when it flips a subscription's FK between `user_id`/`users` and `organization_id`/`organizations`.

With [vike-teams](../vike-teams) supplying `organizations` (and stamping each user's active org onto `current_organization_id`):

```js
// +config.js — build-time: the uploads FK becomes organization_id -> organizations.id
storageOwner: { table: 'organizations', column: 'organization_id' },
```
```bash
# runtime, two halves:
VIKE_STORAGE_OWNER_COLUMN=organization_id          # where to write/scope the owner id
VIKE_STORAGE_OWNER_FROM=current_organization_id    # which field of the signed-in user holds it
```

The request is still authenticated as the signed-in user; the **owner** is then resolved from that user's `current_organization_id`, so an upload is owned by the org and any member of it can read or delete it. A signed-in user who belongs to no org gets `403 no-owner` rather than a file with a blank owner. Leave `storageOwner` unset (and the env vars) and ownership stays the single-user default, byte-for-byte. vike-storage stays decoupled — it never imports vike-teams; the app names the table/column/source field, exactly as vike-stripe takes the resolved subject from the app.

> The owner contract is a shared [`@vike-data/kit`](../kit/README.md#resolveowner) primitive (`resolveOwner`); the same `{ ownerTable, ownerColumn }` binding also backs [vike-push](../vike-push/README.md) and [vike-notifications](../vike-notifications/README.md). See [AUTHORING.md](../../AUTHORING.md#2-own-your-tables-the-stem-pattern) to bind your own extension to it.

## Upload controls

Framework-agnostic helpers (`vike-storage/client`): `uploadFile(file)` and `deleteUpload(id)`. Thin React and Vue controls wrap them:

```jsx
import { FileUpload } from 'vike-storage/react/FileUpload'
<FileUpload onUploaded={({ url }) => console.log(url)} />
```

```vue
<script setup>import FileUpload from 'vike-storage/vue/FileUpload'</script>
<FileUpload @uploaded="onUploaded" />
```

## The `file` field widget

Install the React surface and a column declared `.as('file')` renders an uploader in any consumer that reads the shared field-widget registry (vike-admin today), with no bespoke code:

```js
import storageReactExt from 'vike-storage/react'
export default { extends: [/* ... */ storageExt, storageReactExt] }
```

`vike-storage/react` registers a `file` widget into `@vike-data/kit`'s shared field-widget registry (Option D, #185), so vike-storage depends only on kit and never on vike-admin: neither core knows about the other, and a new consumer gets `.as('file')` for free. The control uploads the chosen file and submits the returned URL as the column value. React today; the Vue widget follows once a Vue field-widget registry exists (the standalone `vike-storage/vue/FileUpload` works now).

## Not yet (follow-ups)

- Real signed URLs / private buckets / per-object access control. `GET` is a capability URL (unguessable key, no per-object ACL) for now.
- Image transforms / thumbnails.
