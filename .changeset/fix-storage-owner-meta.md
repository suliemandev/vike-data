---
'vike-storage': patch
---

vike-storage: declare `storageOwner` in `+config.js` `meta` so the #250 owner binding actually plumbs from an app's `+config.js`. The computed `uploadsSchemas` reads `config.storageOwner`, but Vike rejects an undeclared config key (the same reason vike-stripe declares `segment`/`subjectTable`), so without this an app could not set `storageOwner` to bind uploads to an organization. The runtime half (`VIKE_STORAGE_OWNER_COLUMN`/`_FROM`) was unaffected.
