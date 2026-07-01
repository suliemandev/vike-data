---
'vike-blocks': minor
'vike-view': minor
---

New `vike-blocks` package: the framework-agnostic substrate for composable UI as data, split out of vike-view so it's usable standalone and third parties can add blocks with high DX.

It owns the block descriptor IR + open registry (`registerBlock` / `getBlock` / `listBlocks`), the `definePage({ route, sections })` composer + `resolvePage`, the built-in bespoke blocks (`stat` / `markdown` / `custom`) and fluent primitive blocks (`text` / `heading` / `badge` / `divider` / `link`), and the **`defineBlock`** seam — one call gives a new block its fluent builder + descriptor + registry entry, and the built-in blocks are defined through that same seam. There is deliberately no layout/expression DSL; the long tail ejects to `block: 'custom'` or an AI-generated page.

vike-view is re-layered onto vike-blocks: it now registers its schema-derived `list` / `record` / `form` blocks into vike-blocks' registry, `defineView` is the schema-flavored wrapper over `definePage`, and vike-view re-exports the vike-blocks substrate (composer, registry, `defineBlock`, blocks) as a convenience umbrella. No behavior change: vike-view and vike-admin test suites stay green.
