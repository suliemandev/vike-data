# vike-themes

The **theming core** for vike-data: a two-axis design system compiled to CSS
variables. The **theme** axis is a brand (fonts/radius/spacing + a light and a dark
color set); the **appearance** axis is the mode (`system` follows the OS flash-free,
or explicit `light` / `dark`). Framework-agnostic core; the React binding
(`vike-themes/react`) renders the provider + picker and applies the CSS.

## Usage

```js
// +config.js
import themesExt from 'vike-themes/react'
import { defineTheme } from 'vike-themes'

const acme = defineTheme({
  name: 'acme',
  fonts: { sans: 'Georgia, serif' },
  radius: '4px',
  light: { bg: '#fffdf7', text: '#2a2016', primary: '#b4530d' /* ... */ },
  dark: { bg: '#1a140d', text: '#f3ead9', primary: '#e0772a' /* ... */ },
})

export default {
  extends: [themesExt],   // self-installs the core
  appearance: 'system',   // 'system' | 'light' | 'dark'
  theme: 'acme',          // active brand, from the cumulative `themes` registry
  themes: [acme],         // contribute your brand (built-ins + theme packages compose in)
}
```

## Exports

| Subpath | What |
|---|---|
| `.` | `defineTheme` + the compilers (`themeToVars` / `themeToCss` / `themeToAppearanceCss`), the `exportThemeCss` / `exportThemeConfig` capture helpers, presets, `baseCss`. |
| `./config` | The Vike config: `theme` / `appearance` (single) + the cumulative `themes` registry, plus the cookie-reading `onCreatePageContext`. |
| `./oncreate` | The hook that reads the `vike_theme` / `vike_appearance` cookies. |
| `./react`, `./react/hooks`, `./react/ThemeWrapper` | The provider + picker + `useTheme()`. |

## Key concepts

- **Two orthogonal axes.** Brand (`theme`) is independent of mode (`appearance`) — a
  sidebar layout and a dark Acme brand compose freely.
- **CSS variables.** A theme compiles to `--color-primary`, `--font-sans`, `--radius`,
  etc.; UI authors against the vars, decoupled from any specific brand.
- **System mode is flash-free.** `system` emits a `@media (prefers-color-scheme)` rule
  so the OS preference applies before hydration.
- **Themes compose like packages.** Install [vike-theme-emerald](../vike-theme-emerald)
  and a new brand appears in the picker — no app wiring. Customizing fonts/tokens beyond
  a brand is an [eject](../../CUSTOMIZATION.md), not a per-token config knob.
- **Capture for save / share / SSG.** `exportThemeCss(theme, appearance)` returns the exact
  `:root { … }` block the runtime applies (single source of truth: it reuses the compiler);
  `exportThemeConfig(theme)` returns a normalized JSON config that round-trips through `defineTheme`.
