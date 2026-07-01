---
'vike-view': minor
'vike-admin': patch
---

New `vike-view` package: the framework-agnostic core for schema-driven views (list / record / form), extracted from vike-admin so any renderer or per-table view can reuse it, not just the whole-DB `/admin/*` panel.

It owns `defineView` (+ the `column` / `display` / `field` refinement builders), the schema-to-view-model derivation (`viewColumns` / `viewRecord` / `viewFields`) with semantic-aware widgets and FK-aware selects, the merged-schema resolver + universal-orm repository (`resolveViewTables` / `buildDb`), the row-projection allow-list (`projectRow`), and the validated list query (`parseListQuery`). New over what vike-admin had: a read-only **Record/detail** derivation (`viewRecord`) and a per-table `defineView` (vike-admin's `defineResource` is now an alias).

vike-admin becomes a thin consumer of this core (its `resolve` / `define` / `project` / `query` modules re-export vike-view, keeping every public name); the admin-specific `adminResources` config point stays in vike-admin. No behavior change: the full vike-admin test suite passes through the extracted core unchanged.
