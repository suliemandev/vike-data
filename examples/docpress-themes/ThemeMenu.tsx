export { ThemeMenu }

import React, { useState } from 'react'
import { getPageContext } from 'vike/getPageContext'
import { themeToAppearanceCss } from 'vike-themes'
import { THEMES, THEME_NAMES, APPEARANCES, type ThemeName, type Appearance } from './themes'

// The seam, end to end:
//   vike-themes' agnostic core (`themeToAppearanceCss`) compiles a brand + an
//   appearance to a `body { --color-*: … }` block. DocPress' styles read those
//   vars. No vike-react, no DocPress fork — just CSS variables.
//
// SSR-correct, no flash: the chosen brand/appearance is read from the cookie
// during render (request headers on the server, document.cookie on the client)
// and emitted in an SSR <style>, so a server-rendered page paints the picked
// theme on first paint. Switching a <select> re-renders that same <style>, so
// the palette updates live with no reload.

const COOKIE_THEME = 'vt_theme'
const COOKIE_APPEARANCE = 'vt_appearance'

function readCookie(cookie: string, name: string): string | undefined {
  const m = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]!) : undefined
}

// The cookie string from whichever side is rendering: request headers on the
// server, document.cookie on the client. Both carry the same cookies, so the
// server render and the first client render agree (no hydration mismatch).
function currentCookie(): string {
  let headerCookie: string | undefined
  try {
    headerCookie = (getPageContext() as { headers?: Record<string, string> | null })?.headers?.cookie
  } catch {
    headerCookie = undefined
  }
  if (headerCookie != null) return headerCookie
  return typeof document !== 'undefined' ? document.cookie : ''
}

function initialChoice(): { theme: ThemeName; appearance: Appearance } {
  const cookie = currentCookie()
  const t = readCookie(cookie, COOKIE_THEME)
  const a = readCookie(cookie, COOKIE_APPEARANCE)
  return {
    theme: t && THEME_NAMES.includes(t as ThemeName) ? (t as ThemeName) : 'indigo',
    appearance: a && (APPEARANCES as readonly string[]).includes(a) ? (a as Appearance) : 'system',
  }
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=31536000;samesite=lax`
}

// Static rules rendered in the SSR <style> below — NOT via a component-imported
// stylesheet. In Vite dev, component CSS is injected client-side after first
// paint, so any rule kept there lands late: the content would snap from full
// width to the band, and links would animate from the browser default to the
// theme color (the `transition: color` makes it a visible flicker). Shipping
// these in the SSR HTML applies them on first paint, same as the palette.
//   - .page-content: DocPress leaves landing-page content width-unconstrained;
//     line it up with the top navigation (navMaxWidth: 1140). Doc pages set their
//     own inline width and win over this rule.
//   - a: theme the links DocPress paints from a variable (the landing page has no
//     .doc-page wrapper, so DocPress' own link rule does not reach these).
const STATIC_CSS =
  '.page-content { width: 100%; max-width: 1140px; margin: auto; }\n' +
  'a { color: var(--color-primary); }'

function themeCss(themeName: ThemeName, appearance: Appearance): string {
  const theme = THEMES[themeName] ?? THEMES.indigo
  // Target `body`, NOT the default `:root`. DocPress declares its color variables
  // on `body`, so a :root override is shadowed by the closer body declaration.
  // Append the name bridge in the same block so it wins by source order over
  // DocPress' own `body { --color-bg-white: … }`.
  return themeToAppearanceCss(theme, appearance, 'body') + '\nbody { --color-bg-white: var(--color-bg); }'
}

function ThemeMenu() {
  const [theme, setTheme] = useState<ThemeName>(() => initialChoice().theme)
  const [appearance, setAppearance] = useState<Appearance>(() => initialChoice().appearance)

  function pickTheme(next: ThemeName) {
    setTheme(next)
    writeCookie(COOKIE_THEME, next)
  }
  function pickAppearance(next: Appearance) {
    setAppearance(next)
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
    <>
      {/* Palette + layout + link color, all SSR'd so they land on first paint
          (no theme flash, no width snap, no link-color flicker). */}
      <style dangerouslySetInnerHTML={{ __html: themeCss(theme, appearance) + '\n' + STATIC_CSS }} />
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
    </>
  )
}
