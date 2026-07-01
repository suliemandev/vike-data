---
'vike-view': minor
---

Add `defineView({ route, sections })` — the top-level view primitive: a page is a composition of blocks (the UI/UX schema), distinct from the data schema. Blocks live in an open registry (`registerBlock` / `getBlock` / `listBlocks`): the built-in `list` / `record` / `form` blocks derive from the schema through the same crud engine, while `stat` / `markdown` / `custom` carry their own props. `resolveView(view, tables)` turns the block descriptors into plain, serializable view-models a renderer draws, and `crudBlocks({ table })` is the preset that expands a table into its list/record/form blocks.

This makes vike-view render any page, not just the CRUD triad. The escape hatch for the long tail is `block: 'custom'` or an AI-ejected real page — there is deliberately no layout/expression DSL. The table-flavored view helper is now `crud` (`defineResource` stays an alias), freeing `defineView` for the block primitive.
