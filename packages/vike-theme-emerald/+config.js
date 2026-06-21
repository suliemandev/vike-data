// Register the emerald presets into vike-themes' cumulative `themes` config. The
// app installs this like any extension (`extends: [emeraldExt]`); its presets
// then join the selectable set and the app picks one with `theme: 'emerald-light'`.
// Theme tokens are plain serializable data, so they go inline (no pointer-import).
import { emeraldLight, emeraldDark } from './index.js'

export default {
  name: 'vike-theme-emerald',
  extends: ['import:vike-themes/config:default'],
  themes: [emeraldLight, emeraldDark],
}
