# docpress-themes-example

Spike for [#327](https://github.com/suleimansh/vike-data/issues/327): can `vike-themes` (and `vike-layouts`) be used with [DocPress](https://github.com/brillout/docpress)?

This is a minimal DocPress docs site whose palette is driven live by `vike-themes`. A theme + appearance switcher sits in DocPress' top navigation; picking a brand recompiles the CSS variables and applies them with no reload.

## Run

```bash
# from the repo root
pnpm install
pnpm --filter docpress-themes-example dev
```

Then open the printed URL and use the **Theme** / **Mode** switchers in the top-right.

## How it fits together

| Piece | File | Role |
| --- | --- | --- |
| Agnostic core | `vike-themes` (`themeToAppearanceCss`) | Compiles a brand + appearance to a `body { --color-*: … }` string. Zero framework deps. |
| The switcher | `ThemeMenu.tsx` | Mounted in DocPress' `topNavigation` slot. Reads the chosen brand/appearance from a cookie during render and emits the compiled palette in an **SSR `<style>`**, so the page paints the picked theme on first paint (no flash). Switching a `<select>` re-renders that `<style>` live and persists the choice in the cookie. |
| The bridge | the SSR `<style>` (in `ThemeMenu.tsx`) | Aliases DocPress' own CSS variable name onto vike-themes' (`--color-bg-white: var(--color-bg)`), **scoped to `body`** (see lesson below). This alias is the adapter glue that belongs in vike-data. |
| Brands | `themes.ts` | Two brands via `defineTheme` + the shipped `emerald` brand, proving a theme package needs no DocPress awareness. |

Note: `vike-themes` is **not** added via `extends` in `+config.ts`. DocPress ships its own renderer (it is not `vike-react`), so vike-themes' `vike-react` `Wrapper` hook would not run. The integration therefore uses the framework-agnostic core directly — which is the honest test of whether that core slots into a foreign render pipeline.

## The load-bearing lesson

DocPress declares its color variables on **`body`**, not `:root` (`body { --color-text }`, `body { --color-bg-white }`). A `:root` override is shadowed by the closer `body` declaration and paints nothing — the variables resolve but the page does not re-color. The integration only works once the injected theme **and** the name bridge target `body` and load last in `<head>` (so they win by source order). That scope-matching is the real adapter requirement, and it is what a per-framework `ThemeProvider` would have to know about DocPress.

## What this proves, and what it does not (measured in a real browser)

- **Works:** with the `body`-scope fix, page background flips `#ffffff` → `#06110c` and body text `#16181d` → `#e7f5ee` across brand + dark mode, content links re-color, and the choice persists across reload via cookie. Live, no reload.
- **Limited:** DocPress hardcodes most colors as `rgba(…)` literals (top nav bar, nav shadows, hover tints, code blocks) and ships no dark stylesheet, so that chrome stays fixed — a dark theme flips the body but leaves the top bar light. A complete integration needs DocPress to tokenize its own palette: a change inside DocPress, which is currently marked "only meant to be used by Vike and Telefunc."
- **Out of scope:** `vike-layouts`. DocPress already owns its shell; the two are competing shell systems, not composable layers, and a docs site does not need per-page shell switching.

See the `/coverage` page in the running site for the full caveat write-up.
