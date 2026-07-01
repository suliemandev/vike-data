---
'vike-blocks': minor
---

Add the **`alert`** block (#413) — a leaf catalog element for a tone-styled notice in four intents (info / success / warning / danger). `alert(title).intent('warning').body('...')`, defined through the `defineBlock` seam.

Static and dep-free (from-scratch). Theme-native and cross-framework (React + Vue): the accent per intent is a vike-themes CSS var and the tint is a `color-mix` of that accent over the background, so a theme recolors the whole set. `warn`/`error`/`note` alias to a known intent. The example's custom `callout` block stays the "third-party block" teaching demo; this is the built-in.

Exported from the root (`alert`) and `vike-blocks/react` / `vike-blocks/vue` (`AlertView`). Added unit tests for the builder + resolve, plus an `/alert` demo and a catalog card.
