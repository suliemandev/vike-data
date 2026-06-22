// The config SEAM — themes are installed + selected exactly like every other
// extension (vike-auth, vike-stripe): the app `extends` the theme extension and
// sets a sibling config key. No hand-wiring in the app.
//
// vike-themes declares the contribution points (framework-agnostic — this file
// imports no UI). Two orthogonal axes:
//   - `theme`      : the ACTIVE brand by name. A single selection the app sets and
//                    any page can override (most-specific-wins Vike config).
//   - `appearance` : the mode — 'system' | 'light' | 'dark'. Default 'system'
//                    (follow the OS). Also a single, page-overridable selection.
//   - `themes`     : the available BRANDS. CUMULATIVE, so theme PACKAGES register
//                    their brands here (like `schemas` compose) and the app picks
//                    one by name — install a theme package and it is selectable.
//
// The React rendering (applying the CSS, the runtime picker) is the binding's job
// (vike-themes/react) — same core/UI split as vike-auth -> vike-auth/react. Here we
// only declare the seam, ship the built-in brand, and read the cookies.
import { defaultTheme } from './index.js'

export default {
  name: 'vike-themes',
  meta: {
    theme: { env: { config: true, server: true, client: true } },
    appearance: { env: { config: true, server: true, client: true } },
    themes: { env: { config: true, server: true, client: true }, cumulative: true },
  },
  theme: 'default',
  appearance: 'system',
  themes: [defaultTheme],
  onCreatePageContext: 'import:vike-themes/oncreate:default',
  // The cookie-resolved selection must reach the client so the runtime picker
  // hydrates to the same value the server rendered (no mismatch / flash).
  passToClient: ['themeCookie', 'appearanceCookie'],
}
