---
'vike-blocks': patch
'vike-view': patch
---

Quality + DX hardening of the vike-blocks / vike-view surface (from a code review):

- `crudBlocks` now gives each of its list/record/form descriptors only the keys that block reads, so the three no longer share nested references and the crud config's `scope`/`canView`/`canEdit` **functions** never leak into a (serializable) block descriptor.
- A block/block builder is now detected by a callable `.build`, not truthiness, so a bespoke block may carry a prop literally named `build`.
- `definePage` flattens `sections` fully (a preset of presets composes), and points to `crudBlocks` when a `crud()` config is dropped into `sections` by mistake.
- `resolvePage` names the failing section (`block "x" (section N) failed to resolve: ...`) instead of a context-free throw.
- `defineBlock` validates each `refine` entry is a function at define time (a typo throws where the block author can fix it, not later in app code).
- `resolveView` without the composed tables gives an actionable error instead of a raw TypeError.
- vike-blocks exposes only its package root (the granular subpaths were dropped, so importing it can't bypass the built-in block/block registration).
- Docs: clarified that `resolveView` is `resolvePage` re-exported, that `registerBlockRenderer` is provided by the per-framework renderer package, and added a "what a renderer does with a resolved page" example.
