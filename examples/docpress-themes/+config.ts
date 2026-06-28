export { config }

import docpress from '@brillout/docpress/config'
import type { Config } from 'vike/types'

// Compose the DocPress Vike config. vike-themes is NOT extended here: DocPress
// ships its own renderer (it is not vike-react), so vike-themes' vike-react
// `Wrapper` hook would not be honored. Instead we use vike-themes' framework-
// agnostic core directly from the top-nav control (see ThemeMenu.tsx).
const config = {
  extends: docpress,
} satisfies Config
