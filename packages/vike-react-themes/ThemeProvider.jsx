// vike-react-themes — the React wrapper over the framework-agnostic vike-themes
// core. The core turns tokens into a CSS-variable rule (themeToCss); this applies
// the ACTIVE one and owns the runtime dark/light selection (the build-time vs
// runtime split: definitions are static, selection is state).
//
// SSR-safe: the provider renders the active theme's <style> on the server from
// `initial` (a page can read the cookie off pageContext and pass it in), so the
// first paint already matches and there is no theme flash. On the client,
// toggle() swaps the active theme and persists the choice to a cookie.
import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { themeToCss, presets } from 'vike-themes'

const ThemeCtx = createContext(null)

const writeCookie = (name, value) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function ThemeProvider({ themes = presets, initial = 'light', cookieName = 'vike_theme', children }) {
  const names = Object.keys(themes)
  const [name, setName] = useState(themes[initial] ? initial : names[0])
  const theme = themes[name]

  const setTheme = useCallback(
    (next) => {
      if (!themes[next]) return
      setName(next)
      writeCookie(cookieName, next)
    },
    [themes, cookieName],
  )

  const toggle = useCallback(() => {
    const i = names.indexOf(name)
    setTheme(names[(i + 1) % names.length])
  }, [names, name, setTheme])

  const value = useMemo(() => ({ name, theme, themes, names, setTheme, toggle }), [name, theme, themes, names, setTheme, toggle])

  return (
    <ThemeCtx.Provider value={value}>
      {/* The entire theme contract: the active theme's CSS variables at :root.
          color-scheme keeps native form controls / scrollbars in step — inferred
          from the theme's `scheme` token, else from a `dark` in its name. */}
      <style data-vike-theme={name} dangerouslySetInnerHTML={{ __html: `${themeToCss(theme, ':root')}\n:root { color-scheme: ${(theme.scheme || (/dark/i.test(name) ? 'dark' : 'light'))}; }` }} />
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('[vike-react-themes] useTheme must be used inside <ThemeProvider>')
  return ctx
}
