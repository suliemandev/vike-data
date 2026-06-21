// The vike-react Wrapper contributed by vike-react-themes/config. It turns the
// declarative theme config into a running ThemeProvider:
//   - the registered brands (cumulative `themes` config, from vike-themes + theme
//     packages + the app's own defineTheme) become the selectable set,
//   - the active brand is the `vike_theme` cookie || configured `theme`,
//   - the appearance is the `vike_appearance` cookie || configured `appearance`.
//
// `theme` config may be a brand NAME or a theme OBJECT (both are accepted); an
// object not already in the registry is folded in.
import { usePageContext } from 'vike-react/usePageContext'
import { ThemeProvider } from './ThemeProvider.jsx'
import { ThemePicker } from './ThemePicker.jsx'

export default function ThemeWrapper({ children }) {
  const pageContext = usePageContext()
  const config = pageContext.config || {}

  let list = (config.themes || []).flat()
  const t = config.theme
  const themeName = typeof t === 'string' ? t : t?.name
  // `theme` given as an object that no package registered -> include it.
  if (t && typeof t === 'object' && t.name && !list.some((x) => x.name === t.name)) {
    list = [...list, t]
  }

  const themes = Object.fromEntries(list.map((x) => [x.name, x]))
  const theme = pageContext.themeCookie || themeName || 'default'
  const appearance = pageContext.appearanceCookie || config.appearance || 'system'

  // No brands registered (extension installed but nothing contributed) — render
  // children untouched rather than crashing.
  if (!list.length) return children

  return (
    <ThemeProvider themes={themes} theme={theme} appearance={appearance}>
      {children}
      <ThemePicker />
    </ThemeProvider>
  )
}
