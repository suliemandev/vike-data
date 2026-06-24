---
'@vike-data/universal-schema': patch
---

@vike-data/universal-schema: `mergeSchemas` now clones a fragment's table-level `primaryKey` and `foreignKeys` arrays (and the nested `columns` / `references.columns`) rather than storing the input fragment's own instances, matching the column cloning it already does. A fragment can arrive more than once across renders, so the merged table now fully OWNS its data: a later mutation of `table.primaryKey` / `table.foreignKeys` can no longer bleed back into the source fragment or another merge that shares it. Latent (no current consumer mutates these), but it restores the "merge returns owned data" invariant.
