export { ThemeMenu, headHtml }

import React, { useEffect, useState } from 'react'
import { getPageContext } from 'vike/getPageContext'
import { themeToAppearanceCss } from 'vike-themes'
import { THEMES, THEME_NAMES, APPEARANCES, type ThemeName, type Appearance } from './themes'

// The seam, end to end:
//   vike-themes' agnostic core (`themeToAppearanceCss`) compiles a brand + an
//   appearance to a `body { --color-*: … }` block; a small bridge maps DocPress'
//   `--dp-color-*` seam onto those (see `themeCss`). No vike-react, no DocPress
//   fork — just CSS variables.
//
// No flash, prerender included: the palette is applied by an inline `<head>`
// script (see `headHtml` below) that runs before first paint — it reads the
// chosen brand/appearance from the cookie and writes the `<style id="…">` into
// <head>. This is the single source of truth for the initial palette and works
// even on prerendered/static pages, where there is no request to read a cookie
// from at render time. The React control below does NOT render that <style>
// (a body-rendered copy would collide by id and lose by source order on
// prerendered HTML); on switch it updates the same head <style> imperatively.

const STYLE_ID = 'vike-themes-override'
const COOKIE_THEME = 'vt_theme'
const COOKIE_APPEARANCE = 'vt_appearance'

function readCookie(cookie: string, name: string): string | undefined {
  const m = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]!) : undefined
}

// The cookie string from whichever side is rendering: request headers on the
// server, document.cookie on the client. Used only to seed the <select> values.
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
  // vike-themes emits its agnostic `--color-*` contract on `body`. DocPress
  // (>=0.16.49) reads a `--dp-`-prefixed seam, so bridge its names onto ours in
  // the same block — this adapter glue is what belongs in vike-data. The bridge
  // references the variables (not fixed values), so it tracks light/dark/system
  // for free. Target `body`: more specific than DocPress' `:root` seam, so it
  // wins. `--color-bg-white` is a :root-declared alias (from `--dp-color-bg`),
  // so it is re-set on body too.
  const bridge =
    'body {' +
    ' --dp-color-bg: var(--color-bg);' +
    ' --dp-color-surface: var(--color-surface);' +
    ' --dp-color-text: var(--color-text);' +
    ' --dp-color-muted: var(--color-muted);' +
    ' --dp-color-border: var(--color-border);' +
    ' --dp-color-primary: var(--color-primary);' +
    ' --color-bg-white: var(--color-bg);' +
    ' }'
  return themeToAppearanceCss(theme, appearance, 'body') + '\n' + bridge
}

// The whole palette, compiled once at build time: brand → appearance → CSS. The
// no-flash <head> script (below) carries this map so it can apply the cookie's
// palette synchronously, with no request and no module import, before paint.
const PALETTE: Record<string, Record<string, string>> = Object.fromEntries(
  THEME_NAMES.map((t) => [t, Object.fromEntries(APPEARANCES.map((a) => [a, themeCss(t, a)]))]),
)

// Inline <head> script: read the cookie, pick the palette, write the <style>
// before first paint. Self-contained (the palette map is inlined) so it runs
// with no bundle and on prerendered/static pages. Escape `<` so the embedded
// JSON can never break out of the <script> element.
const headHtml: string =
  `<script>(function(){` +
  `var P=${JSON.stringify(PALETTE).replace(/</g, '\\u003c')},` +
  `id=${JSON.stringify(STYLE_ID)};` +
  `function c(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null}` +
  `var t=c(${JSON.stringify(COOKIE_THEME)});if(!P[t])t='indigo';` +
  `var a=c(${JSON.stringify(COOKIE_APPEARANCE)});if(a!=='light'&&a!=='dark')a='system';` +
  `var e=document.getElementById(id);if(!e){e=document.createElement('style');e.id=id;document.head.appendChild(e)}` +
  `e.textContent=P[t][a]})();</script>`

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

  // The head script applies the palette on first paint; from then on, mirror
  // every switch onto that same <head> <style> (it is not React-owned, so we
  // update it imperatively rather than re-rendering it here).
  useEffect(() => {
    const el = document.getElementById(STYLE_ID)
    if (el) el.textContent = themeCss(theme, appearance)
  }, [theme, appearance])

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
      {/* The palette itself is applied by the no-flash <head> script (see
          `headHtml`); this control only seeds the <select> values and mirrors
          switches onto that head <style>. Layout + link color are SSR'd inline
          here so they land on first paint (no width snap, no link-color flash). */}
      <style dangerouslySetInnerHTML={{ __html: STATIC_CSS }} />
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
