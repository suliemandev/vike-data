// The config SEAM — themes are installed + selected exactly like every other
// extension (vike-auth, vike-billing): the app `extends` the theme extension and
// sets a sibling config key. No hand-wiring in the app.
//
// vike-themes declares two contribution points (framework-agnostic — this file
// imports no UI):
//   - `theme`  : the ACTIVE theme by name. A single selection, so the app sets a
//                default and any page can override it (pages/x/+config.js), the
//                same most-specific-wins config Vike already does.
//   - `themes` : the available PRESETS. CUMULATIVE, so theme PACKAGES register
//                their presets here (like `schemas` compose) and the app picks one
//                by name — install a theme package and it is selectable.
//
// The React rendering (applying the CSS variables, the runtime picker) is the job
// of the binding, vike-react-themes — same core/UI split as vike-auth ->
// vike-react-auth. Here we only declare the seam, ship the built-in presets, and
// read the theme cookie into pageContext (cookie handling is framework-agnostic).
import { light, dark } from './index.js'

export default {
  name: 'vike-themes',
  meta: {
    theme: { env: { config: true, server: true, client: true } },
    themes: { env: { config: true, server: true, client: true }, cumulative: true },
  },
  theme: 'light',
  themes: [light, dark],
  onCreatePageContext: 'import:vike-themes/oncreate:default',
}
