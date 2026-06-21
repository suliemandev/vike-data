// The React binding (vike-themes/react subpath) over the framework-agnostic
// vike-themes core. It owns the two runtime axes: the active THEME (brand) and the
// APPEARANCE (mode: system/light/dark). The core turns a (theme, appearance) pair
// into CSS (themeToAppearanceCss); this applies it and persists each axis to a cookie.
//
// SSR-safe: the provider renders from `theme`/`appearance` props (a page reads the
// cookies off pageContext and passes them in), so first paint matches and there is
// no flash. `system` is applied via the core's `@media (prefers-color-scheme)` CSS,
// so it follows the OS even before hydration.
import { useState, useMemo, useCallback } from 'react'
import { themeToAppearanceCss, baseCss, presets, APPEARANCES } from '../index.js'
import { ThemeCtx } from './context.js'

const writeCookie = (name, value) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function ThemeProvider({ themes = presets, theme: initialTheme = 'default', appearance: initialAppearance = 'system', children }) {
  const names = Object.keys(themes)
  const [themeName, setThemeName] = useState(themes[initialTheme] ? initialTheme : names[0])
  const [appearance, setApp] = useState(APPEARANCES.includes(initialAppearance) ? initialAppearance : 'system')
  const theme = themes[themeName]

  const setTheme = useCallback(
    (next) => {
      if (!themes[next]) return
      setThemeName(next)
      writeCookie('vike_theme', next)
    },
    [themes],
  )

  const setAppearance = useCallback((next) => {
    if (!APPEARANCES.includes(next)) return
    setApp(next)
    writeCookie('vike_appearance', next)
  }, [])

  const value = useMemo(
    () => ({ theme, themeName, themes, names, setTheme, appearance, appearances: APPEARANCES, setAppearance }),
    [theme, themeName, themes, names, setTheme, appearance, setAppearance],
  )

  return (
    <ThemeCtx.Provider value={value}>
      {/* The whole theme contract: the active brand's variables for the active
          appearance (system -> light + a prefers-color-scheme dark media rule),
          plus the minimal base/reset authored against those variables. */}
      <style
        data-vike-theme={themeName}
        data-vike-appearance={appearance}
        dangerouslySetInnerHTML={{ __html: `${themeToAppearanceCss(theme, appearance, ':root')}\n${baseCss}` }}
      />
      {children}
    </ThemeCtx.Provider>
  )
}
