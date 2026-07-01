---
'vike-elements': minor
'vike-view': minor
---

New `vike-elements` package: the framework-agnostic substrate for composable UI as data, split out of vike-view so it's usable standalone and third parties can add elements with high DX.

It owns the block descriptor IR + open registry (`registerBlock` / `getBlock` / `listBlocks`), the `definePage({ route, sections })` composer + `resolvePage`, the built-in bespoke blocks (`stat` / `markdown` / `custom`) and fluent primitive elements (`text` / `heading` / `badge` / `divider` / `link`), and the **`defineElement`** seam — one call gives a new element its fluent builder + descriptor + registry entry, and the built-in elements are defined through that same seam. There is deliberately no layout/expression DSL; the long tail ejects to `block: 'custom'` or an AI-generated page.

vike-view is re-layered onto vike-elements: it now registers its schema-derived `list` / `record` / `form` blocks into vike-elements' registry, `defineView` is the schema-flavored wrapper over `definePage`, and vike-view re-exports the vike-elements substrate (composer, registry, `defineElement`, elements) as a convenience umbrella. No behavior change: vike-view and vike-admin test suites stay green.
