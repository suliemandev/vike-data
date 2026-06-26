---
'vike-storage': minor
---

vike-storage: harden the upload path against provider path-traversal and memory-exhaustion.

1. The raw segment after `/uploads/` was forwarded to `provider.get()` unvalidated, so a naive disk/S3 provider doing `join(root, key)` was traversable via `GET /uploads/..%2f..%2fetc%2fpasswd` (percent-encoded `..%2f` survives `new URL().pathname`). A storage key is always a UUID this package minted, so `readUpload` now rejects anything else before the provider is ever called (new `isStorageKey` export), and the README documents that providers must still reject path separators / `..`.

2. `POST /uploads` buffered the entire body into memory with no cap. Uploads are now capped at `getMaxUploadBytes()` (default 10 MiB; configurable via `setMaxUploadBytes()` or `VIKE_STORAGE_MAX_UPLOAD_BYTES`): an over-size `Content-Length` is rejected with `413` before buffering, and a missing/understated `Content-Length` is caught by re-checking the parsed file size.
