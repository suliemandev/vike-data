---
'vike-blocks': minor
---

Add the **`card`** block (#412) — a static CONTAINER block and the catalog's most-used building block: a bordered, padded surface with an optional header (title + description) and footer, wrapping a nested composition of blocks resolved recursively. `card(sections)` (or `.body(sections)`) sets the body; `.title()` / `.description()` the header, `.footer(sections)` the footer.

Theme-native and cross-framework (React + Vue), styled on the `var(--color-*)` / `--radius` contract (surface, border, text, muted) so a theme restyles every card for free. Unlike `tabs`/`accordion` it holds no live UI state — a card is a plain themed box, dep-free. Cards compose recursively (a card holds any blocks, including other cards), reusing the container/resolve-recursively pattern from `tabs`.

Exported from the root (`card`) and `vike-blocks/react` / `vike-blocks/vue` (`CardView`). Added unit tests for the builder + recursive resolve (header pass-through, footer, nesting), plus a `/card` demo and a catalog card.
