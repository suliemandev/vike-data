# vike-toolbar

A small, fixed toolbar surface for vike-data: a logo button + a settings popover that
other extensions drop their controls into (the locale switcher, the theme picker).
Framework-agnostic core (the item shape + composition); the React binding
(`vike-toolbar/react`) renders the button + panel + a teleport surface.

## Usage

```js
// +config.js
import toolbarExt from 'vike-toolbar/react'

export default {
  extends: [toolbarExt],   // self-installs the core
}
```

Install it and the button appears; installed extensions populate the panel
automatically (no app wiring). An extension contributes either way:

```js
import { defineToolbarItems } from 'vike-toolbar'
// static items (context-free controls)
export default { extends: ['import:vike-toolbar/config:default'], toolbarItems: defineToolbarItems([...]) }
```

## Exports

| Subpath | What |
|---|---|
| `.` | The core: `defineToolbarItems()` / `allToolbarItems()` (normalize + sort + de-dupe by id), plus the canonical DOM-id constants `TOOLBAR_ROOT_ID` (`vike-toolbar-root`) and `TOOLBAR_ITEMS_ID` (`vike-toolbar-items`) that consumers teleport into. |
| `./config` | The Vike config: the cumulative `toolbarItems` registry + the `bodyHtmlEnd` mount node. |
| `./react`, `./react/Toolbar`, `./react/ToolbarWrapper` | The button + portalled panel + teleport surface. |

## Key concepts

- **Two composition paths.** *Teleport* — a provider-bound control (e.g. the theme
  picker) teleports into the panel's `#vike-toolbar-items` node, keeping its React
  context. *Static items* — context-free controls contributed via the cumulative
  `toolbarItems` registry, rendered directly.
- **Out-of-hydration-root portal.** The panel portals into a `bodyHtmlEnd` node outside
  Vike's hydration root, so a teleported control arriving post-hydration never triggers a
  reconciliation conflict.
- **No flash.** The button is server-rendered and the panel stays hidden until toggled,
  so nothing flickers on load.

Part of the composable-chrome work (epic #120); integrates with
[vike-layouts](../vike-layouts)' toolbar slot and stands alone without a layout.
