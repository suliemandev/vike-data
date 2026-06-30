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
| The switcher | `ThemeMenu.tsx` | Mounted in DocPress' `topNavigation` slot. Seeds the `<select>` values from the cookie and, on switch, persists the choice and mirrors the new palette onto the head `<style>`. |
| No-flash head script | `headHtml` (in `ThemeMenu.tsx`, wired via `config.headHtml`) | An inline `<head>` script that reads the cookie and applies the palette **before first paint**. It carries the whole brand × appearance palette inlined, so it needs no request and no bundle — it works on both per-request SSR and **prerendered/static** pages (the latter has no request to read a cookie from at render time). This is the single source of truth for the initial palette. |
| The bridge | the head `<style>` (written by `headHtml`) | Maps DocPress' `--dp-color-*` seam onto vike-themes' emitted `--color-*` (e.g. `--dp-color-bg: var(--color-bg)`), **scoped to `body`** (see lesson below). This adapter glue is what belongs in vike-data. |
| Brands | `themes.ts` | Two local brands plus the shipped `emerald` brand. All of them only author `primary`; the core derives `primary-light` / `primary-dark`. |

Note: `vike-themes` is **not** added via `extends` in `+config.ts`. DocPress ships its own renderer (it is not `vike-react`), so vike-themes' `vike-react` `Wrapper` hook would not run. The integration therefore uses the framework-agnostic core directly — which is the honest test of whether that core slots into a foreign render pipeline.

## The load-bearing lesson

DocPress declares its `--dp-color-*` seam on **`:root`** (and derives internal aliases like `--color-bg-white` from it there). The example sets the brand palette **and** the bridge on **`body`**, which sits below `:root` in the tree — so its declaration is the one every descendant inherits, and the page re-colors. The one catch: `--color-bg-white` is declared only on `:root`, so a body-level `--dp-color-bg` never reaches it; the bridge re-sets `--color-bg-white` on `body` too. Both also load last in `<head>` so they win by source order. That scope-matching is the real adapter requirement, and it is what a per-framework `ThemeProvider` would have to know about DocPress.

## What this proves, and what it does not (measured in a real browser)

- **Works:** with the `body`-scope fix, page background flips `#ffffff` → `#06110c` and body text `#16181d` → `#e7f5ee` across brand + dark mode, content links re-color, and the choice persists across reload via cookie. Live, no reload.
- **Limited:** DocPress hardcodes most colors as `rgba(…)` literals (top nav bar, nav shadows, hover tints, code blocks) and ships no dark stylesheet, so that chrome stays fixed — a dark theme flips the body but leaves the top bar light. A complete integration needs DocPress to tokenize its own palette: a change inside DocPress, which is currently marked "only meant to be used by Vike and Telefunc."
- **Out of scope:** `vike-layouts`. DocPress already owns its shell; the two are competing shell systems, not composable layers, and a docs site does not need per-page shell switching.

See the `/coverage` page in the running site for the full caveat write-up.
