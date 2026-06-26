---
'vike-storage': patch
---

vike-storage: `GET /uploads/:key` no longer serves stored bytes under their browser-supplied mime, which let an authenticated user upload `text/html` containing `<script>` and have it execute from the app's own origin (cookie/session theft). The endpoint now always sends `X-Content-Type-Options: nosniff`, serves only a small allowlist of inert image types (`png`, `jpeg`, `gif`, `webp`, `avif`) inline, and forces everything else (including `text/html` and script-capable `image/svg+xml`) to `application/octet-stream` with `Content-Disposition: attachment` so the browser downloads rather than renders it.
