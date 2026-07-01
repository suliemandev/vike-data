---
'vike-elements': minor
'vike-view': minor
'@vike-data/kit': patch
---

Vue renderers as `vike-elements/vue` + `vike-view/vue` subpaths — the Vue twin of the React binding, in the same packages (matching vike-auth's `./react` + `./vue` convention, no separate `vike-vue-*` package).

- **vike-elements/vue**: the block-renderer registry (`registerElementRenderer` over the shared 'blocks'/'vue' slot), the `<Blocks>`/`<Page>` dispatch, and the built-in primitive components (Text / Heading / Badge / Divider / Link / Markdown / Stat).
- **vike-view/vue**: `ListView` / `RecordView` / `FormView` self-registered for the `list` / `record` / `form` block types, plus a real **Vue field-widget registry** + widgets + `FormFields` (the registry that was previously "React-first" — now Vue has parity, so a `.as('file')` column can render an extension's Vue control).
- **@vike-data/kit**: `createComponentRegistry` now accepts a component that is a function OR an object, so a Vue component (an options object) can be registered — this also fixes React `memo`/`forwardRef` components (which are objects). This was the blocker that kept the shared registry React-only.

The Vue components are written as functional components (a function of props with an explicit `.props`), the closest Vue analog to the React function components, so no `.vue` compile step. Verified end to end via `@vue/server-renderer`: a `defineView` of elements + `crudBlocks` server-renders to HTML with the schema driving the list table, record fields, and form controls (enum → `<select>`, boolean → checkbox).
