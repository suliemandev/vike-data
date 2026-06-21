// The vike-react Wrapper contributed by vike-react-themes/config. It turns the
// declarative theme config into a running ThemeProvider: the registered presets
// (cumulative `themes` config, contributed by vike-themes + any theme package +
// the app's own defineTheme) become the selectable set, and the active theme is
// the cookie (runtime picker) falling back to the configured `theme` default.
//
// Because it is a Wrapper it sits outside the Layout, so the theme's CSS variables
// are set before any shell renders — themes restyle layouts, not the other way.
import { usePageContext } from 'vike-react/usePageContext'
import { ThemeProvider } from './ThemeProvider.jsx'
import { ThemePicker } from './ThemePicker.jsx'

export default function ThemeWrapper({ children }) {
  const pageContext = usePageContext()
  const config = pageContext.config || {}
  // `themes` is cumulative: an array of each source's contribution (itself an
  // array of theme defs). Flatten and key by name into the selectable set.
  const list = (config.themes || []).flat()
  const themes = Object.fromEntries(list.map((t) => [t.name, t]))
  const initial = pageContext.themeCookie || config.theme || 'light'

  // No themes registered (extension installed but nothing contributed) — render
  // children untouched rather than crashing.
  if (!list.length) return children

  return (
    <ThemeProvider themes={themes} initial={initial}>
      {children}
      <ThemePicker />
    </ThemeProvider>
  )
}
