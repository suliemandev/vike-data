---
'vike-elements': minor
'vike-view': minor
'@vike-data/kit': minor
---

React renderers for the block/element system, as package subpaths (matching vike-auth's `./react` convention — no separate `vike-react-*` packages).

- **vike-elements/react**: the dispatch machinery — `<Blocks>` / `<Page>` walk a resolved view and draw each section with its registered component — plus `registerElementRenderer` (the per-framework half of the element seam) and the built-in primitive components (Text / Heading / Badge / Divider / Link / Markdown / Stat).
- **vike-view/react**: the schema renderers — `ListView` / `RecordView` / `FormView` — which register themselves as the renderers for the `list` / `record` / `form` block types. `FormView` derives its controls from the field widget/type (an enum column renders a `<select>`, a required column is marked, etc.).
- **@vike-data/kit**: `createComponentRegistry(namespace, name)` — the generic, cross-package, globalThis-keyed component registry that both the field-widget registry and the new block-renderer registry delegate to (block renderers being the third consumer). `createFieldWidgetRegistry` now delegates to it; its public surface is unchanged.

A third-party element ships in two halves: `defineElement(...)` (agnostic descriptor + builder) and `registerElementRenderer(type, Component)` (per framework). Verified end to end: a `defineView` composing elements + `crudBlocks` server-renders to HTML, with the schema driving the list columns, record fields, and form controls.
