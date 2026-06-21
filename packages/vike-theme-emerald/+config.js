// Register the Emerald brand into vike-themes' cumulative `themes` config. The app
// installs this like any extension (`extends: [emeraldExt]`); Emerald then joins
// the selectable set and the app picks it with `theme: 'emerald'`. Theme tokens are
// plain serializable data, so they go inline (no pointer-import).
import { emerald } from './index.js'

export default {
  name: 'vike-theme-emerald',
  extends: ['import:vike-themes/config:default'],
  themes: [emerald],
}
