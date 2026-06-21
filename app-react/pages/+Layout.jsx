// Root layout: wraps every page in the ThemeProvider (so the active theme's CSS
// variables are set globally and useTheme() is available) and renders the
// floating theme toggle. The per-page SHELL (centered/topbar) is chosen inside
// each page — theme is global, layout shell is per-page.
import { ThemeProvider } from 'vike-react-themes'
import { usePageContext } from 'vike-react/usePageContext'
import { ThemeToggle } from '../components/ThemeToggle.jsx'

export default function LayoutRoot({ children }) {
  const pageContext = usePageContext()
  return (
    <ThemeProvider initial={pageContext.themeCookie || 'light'}>
      {children}
      <ThemeToggle />
    </ThemeProvider>
  )
}
