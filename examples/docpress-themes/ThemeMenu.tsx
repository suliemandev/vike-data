export { ThemeMenu }

import React, { useEffect, useState } from 'react'
import { themeToAppearanceCss } from 'vike-themes'
import { THEMES, THEME_NAMES, APPEARANCES, type ThemeName, type Appearance } from './themes'
import './theme-bridge.css'

// The seam, end to end:
//   vike-themes' agnostic core (`themeToAppearanceCss`) compiles a brand + an
//   appearance to a `:root { --color-*: … }` block, which we append to <head>.
//   DocPress' styles read those vars through theme-bridge.css. No vike-react,
//   no DocPress fork — just CSS variables. This is exactly what the per-framework
//   ThemeProvider does internally; here we drive it by hand because DocPress is
//   not a vike-react app and would not honor vike-themes' Wrapper hook.

const STYLE_ID = 'vike-themes-override'
const COOKIE_THEME = 'vt_theme'
const COOKIE_APPEARANCE = 'vt_appearance'

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]!) : undefined
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=31536000;samesite=lax`
}

function applyTheme(themeName: ThemeName, appearance: Appearance): void {
  const theme = THEMES[themeName] ?? THEMES.indigo
  // Target `body`, NOT the default `:root`. DocPress declares its color variables
  // on `body` (e.g. `body { --color-text: …; --color-bg-white: … }`), so a :root
  // override is shadowed by the closer body declaration. Writing the same vars on
  // `body` from a <style> appended last to <head> wins by source order.
  // Append the name bridge in the SAME (last) <style> so it wins by source order
  // over DocPress' own `body { --color-bg-white: #fdfdfd }` literal.
  const css = themeToAppearanceCss(theme, appearance, 'body') + '\nbody { --color-bg-white: var(--color-bg); }'
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = css
}

function ThemeMenu() {
  // First render must match SSR (no cookie access), so start from the defaults
  // baked into theme-bridge.css; restore the saved choice after hydration.
  const [theme, setTheme] = useState<ThemeName>('indigo')
  const [appearance, setAppearance] = useState<Appearance>('system')

  useEffect(() => {
    const t = readCookie(COOKIE_THEME) as ThemeName | undefined
    const a = readCookie(COOKIE_APPEARANCE) as Appearance | undefined
    const nextTheme = t && THEME_NAMES.includes(t) ? t : 'indigo'
    const nextAppearance = a && (APPEARANCES as readonly string[]).includes(a) ? a : 'system'
    setTheme(nextTheme)
    setAppearance(nextAppearance)
    applyTheme(nextTheme, nextAppearance)
  }, [])

  function pickTheme(next: ThemeName) {
    setTheme(next)
    applyTheme(next, appearance)
    writeCookie(COOKIE_THEME, next)
  }
  function pickAppearance(next: Appearance) {
    setAppearance(next)
    applyTheme(theme, next)
    writeCookie(COOKIE_APPEARANCE, next)
  }

  const controlStyle: React.CSSProperties = {
    background: 'var(--color-surface, #f6f7f9)',
    color: 'var(--color-text, #16181d)',
    border: '1px solid var(--color-border, #e4e7ec)',
    borderRadius: 'var(--radius, 8px)',
    padding: '4px 8px',
    font: 'inherit',
    cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 var(--padding-side, 12px)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ opacity: 0.7, fontSize: 13 }}>Theme</span>
        <select
          aria-label="Theme"
          value={theme}
          onChange={(e) => pickTheme(e.target.value as ThemeName)}
          style={controlStyle}
        >
          {THEME_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ opacity: 0.7, fontSize: 13 }}>Mode</span>
        <select
          aria-label="Appearance"
          value={appearance}
          onChange={(e) => pickAppearance(e.target.value as Appearance)}
          style={controlStyle}
        >
          {APPEARANCES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
