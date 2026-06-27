---
'vike-themes': minor
---

vike-themes: add `exportThemeCss(theme, appearance, selector)` and `exportThemeConfig(theme)` to capture the active theme for save / share / SSG (#293). `exportThemeCss` returns the exact `:root { … }` block the runtime applies for an appearance by reusing `themeToAppearanceCss` as the single source of truth (so a captured stylesheet can never drift from what gets applied); `exportThemeConfig` returns a normalized, pretty-printed JSON config that round-trips back through `defineTheme`. Both normalize their input first, so a raw token object works too. Pure framework-agnostic functions on the core; no behaviour change to existing exports.
