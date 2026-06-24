# vike-theme-emerald

An example **theme package** for [vike-themes](../vike-themes): an emerald (green,
rounder-cornered) brand carrying both a light and a dark mode. It exists to demonstrate
the pattern — `defineTheme` one brand, register it via `+config.js`, and the app picks it
by name with zero wiring.

## Usage

```js
// +config.js
import emeraldExt from 'vike-theme-emerald/config'

export default {
  extends: [themesExt, emeraldExt],   // emerald registers into the cumulative `themes`
  theme: 'emerald',                   // ...and the app selects it by name
}
```

That's the whole integration: install it and `emerald` becomes a selectable theme in the
picker. No token wiring, no custom definition.

## Exports

| Subpath | What |
|---|---|
| `.` | The `emerald` theme object (a plain `defineTheme` result). |
| `./config` | The Vike config that contributes `emerald` to vike-themes' cumulative `themes`. |

## Why it's here

It's the proof that themes **compose like packages**: a theme is just data, contributed
through the same cumulative config point as everything else. Customizing a brand's
tokens beyond what `defineTheme` exposes is an [eject](../../CUSTOMIZATION.md), not a
per-token config knob.
