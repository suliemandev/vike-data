// vike-toolbar — the config SEAM (epic #120, #121).
//
// The toolbar is a SURFACE, not an owner: it provides one shared place for settings,
// and each extension keeps owning its own (live) control. Composition works two ways:
//
//   1. `bodyHtmlEnd` injects a stable mount node OUTSIDE the framework hydration root
//      (Vike's documented pattern for portals/teleports). The React UI portals the
//      button + panel into it; an extension's own picker (vike-themes, vike-i18n, ...)
//      teleports its LIVE control into the panel's `#vike-toolbar-items` node — keeping
//      its provider context — or renders standalone when no toolbar is installed. The
//      contract is just a DOM id, so it is framework-agnostic (React portal / Vue
//      Teleport / Solid Portal all target the same node) and needs no import coupling.
//
//   2. `toolbarItems` is the cumulative seam for SIMPLE, context-free controls an app
//      or extension wants the toolbar itself to render (same pattern as nav/themes).
//      Live, provider-bound controls use the teleport path (1) instead.
//
// `bodyHtmlEnd` is global + cumulative + server-env (it is SSR'd HTML); `toolbarItems`
// is server + client (NOT config: an entry's `Control` is .jsx, which Vike can't load
// during plain-Node config resolution). Framework-agnostic: no UI is imported here; the
// React Wrapper is pulled in by the vike-toolbar/react subpath.
import { TOOLBAR_ROOT_ID } from './index.js'

export default {
  name: 'vike-toolbar',
  meta: {
    toolbarItems: { env: { server: true, client: true }, cumulative: true },
  },
  toolbarItems: [],
  // The out-of-hydration-root mount node the React UI portals into (and that other
  // extensions teleport their controls into). One element, owned by vike-toolbar.
  bodyHtmlEnd: `<div id="${TOOLBAR_ROOT_ID}"></div>`,
}
