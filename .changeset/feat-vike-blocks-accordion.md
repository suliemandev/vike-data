---
'vike-blocks': minor
---

Add the **`accordion`** block (#414) — the catalog's second interactive built-in and a CONTAINER block like `tabs`: each item holds a nested composition of blocks, resolved recursively. `accordion().item(value, label, sections)`, with `.multiple()` for multi-open (default single-open) and `.defaultValue(value | values)` for the initial open set.

Theme-native and cross-framework (React + Vue), styled on the `var(--color-*)` / `--radius` contract. The renderer owns the live open/closed state; each panel morphs its height between 0 and its measured natural height and fades in — the same zero-dependency technique the `tabs` renderer uses (no animation dependency; an app wanting a motion version swaps the renderer via `registerBlockRenderer`). Harvested from Animate UI's Base accordion and reimplemented dep-free.

Exported from the root (`accordion`) and `vike-blocks/react` / `vike-blocks/vue` (`AccordionView`). Added unit tests for the builder + resolve (single/multi-open, initial open set), plus an `/accordion` demo and a catalog card.
