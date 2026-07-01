---
'vike-blocks': patch
---

Give `heading` blocks a level-scaled top margin (#417), so an `h2`/`h3` section heading separates from the block above it instead of butting against it. A page-title `h1` stays flush (it is usually the first block on a page). Applied to both the React and Vue renderers.
