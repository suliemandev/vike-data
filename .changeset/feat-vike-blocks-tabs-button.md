---
'vike-blocks': minor
---

Start the built-in block catalog (#399): two new blocks, theme-native and cross-framework (React + Vue), styled on the `var(--color-*)` / `--radius` contract so a vike-theme restyles them for free.

- **`tabs`** — the first interactive built-in and a CONTAINER block: each panel is itself a composition of blocks, resolved recursively. `tabs().tab(value, label, sections).defaultValue(v)`. The renderer owns the live active-tab state; the sliding highlight, the panel fade-in, and the height morph are all pure CSS (no animation dependency — an app wanting a motion version just swaps the renderer via `registerBlockRenderer`).
- **`button`** — a leaf block (via `defineBlock`): `button('Save').variant('primary')`, with `.variant()` (primary/secondary/ghost/danger), `.size()`, and `.to(path)` for a link styled as a button (behaviour that mutates is the actions axis, #385).

Both register their agnostic resolver + a renderer per framework, and are exported from the root (`tabs`, `button`) and `vike-blocks/react` / `vike-blocks/vue` (`TabsView`, `ButtonView`). Added unit tests for the builders + resolve (30 total green).
