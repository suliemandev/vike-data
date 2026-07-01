---
'vike-view': minor
---

Add fluent element builders (`vike-view/elements`): `text` / `heading` / `badge` / `divider` / `link`. Each is a lowercase factory (matching the `column`/`field`/`display` idiom) whose `.build()` collapses to a plain leaf-block descriptor, so an element drops straight into a view's `sections` and resolves through the block registry as a pass-through. This is the nicer authoring surface for the non-schema bits of a page.

Display-only for now — interactivity (a button that runs behavior) is a separate axis, since behavior can't be an inline closure in serializable config; `link().to(path)` covers declarative navigation until the actions layer is scoped.
