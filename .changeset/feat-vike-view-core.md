---
'vike-view': minor
'vike-admin': patch
---

New `vike-view` package: the framework-agnostic core for schema-driven views, extracted from vike-admin so any renderer or view can reuse it, not just the whole-DB `/admin/*` panel.

The top-level primitive is a **view = a composition of blocks** (a UI/UX schema); this release ships the built-in **`crud` preset** — the list / record / form blocks for a table, the 80% case and the engine those blocks are built on. `crud` owns the `column` / `display` / `field` refinement builders, the schema-to-view-model derivation (`viewColumns` / `viewRecord` / `viewFields`) with semantic-aware widgets and FK-aware selects, the merged-schema resolver + universal-orm repository (`resolveViewTables` / `buildDb`), the row-projection allow-list (`projectRow`), and the validated list query (`parseListQuery`). New over what vike-admin had: a read-only **Record/detail** derivation (`viewRecord`). The general `defineView({ route, sections })` block primitive is the epic's next issue.

vike-admin becomes a thin consumer of this core (its `resolve` / `define` / `project` / `query` modules re-export vike-view, keeping every public name; `defineResource` is now an alias of `crud`); the admin-specific `adminResources` config point stays in vike-admin. No behavior change: the full vike-admin test suite passes through the extracted core unchanged.
