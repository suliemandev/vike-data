---
'vike-blocks': minor
---

Add the **`dialog`** block (#415) — the catalog's most interactive built-in and a CONTAINER block: a trigger button opens a modal overlay that holds a nested composition of blocks. `dialog().title(...).description(...).trigger(label).sections([...]).footer([...])`, with `.defaultOpen()`.

Theme-native and cross-framework (React + Vue), styled on the `var(--color-*)` / `--radius` contract. Where Animate UI's Base dialog leans on Base UI, the renderers do it dep-free themselves: a portal (React `createPortal` / Vue `Teleport` to `<body>`), a backdrop, a focus trap (Tab cycles inside the popup), Escape + backdrop-click to close, body scroll-lock, and a CSS enter/exit (backdrop fade + popup fade/scale). Open/close is local UI state; a confirm button that mutates data is the actions axis (#385). Harvested from Animate UI's Base dialog and reimplemented dep-free.

Exported from the root (`dialog`) and `vike-blocks/react` / `vike-blocks/vue` (`DialogView`). Added unit tests for the builder + resolve (body/footer recursion, defaultOpen, defaults), plus a `/dialog` demo and a catalog card.
