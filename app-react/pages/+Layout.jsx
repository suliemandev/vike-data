// Root layout: hands the ThemeProvider the app's composed theme map (built-ins +
// the installed emerald package + the custom Acme brand — see theme/themes.js) and
// renders the theme picker. The active theme's CSS variables are set globally, so
// the per-page shells and the login card all restyle when you switch.
import { ThemeProvider } from 'vike-react-themes'
import { usePageContext } from 'vike-react/usePageContext'
import { themes, defaultTheme } from '../theme/themes.js'
import { ThemePicker } from '../components/ThemePicker.jsx'

export default function LayoutRoot({ children }) {
  const pageContext = usePageContext()
  return (
    <ThemeProvider themes={themes} initial={pageContext.themeCookie || defaultTheme}>
      {children}
      <ThemePicker />
    </ThemeProvider>
  )
}
