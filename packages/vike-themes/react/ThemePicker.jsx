// The runtime theme switcher: two controls for the two axes — Appearance (System /
// Light / Dark) and Theme (the registered brands, shown only when there's more than
// one). Both switch live and persist via cookie.
//
// Placement composes with vike-toolbar: when a toolbar is installed, the controls
// TELEPORT into its shared popover (#vike-toolbar-items) so all settings live in one
// place; with no toolbar they render standalone (fixed, bottom-right). Either way the
// controls render inside this extension's ThemeProvider, so useTheme stays live — the
// portal moves the DOM, not the React tree, so context is preserved.
import { createPortal } from 'react-dom'
import { useTheme } from './context.js'
import { useToolbarSlot } from './useToolbarSlot.js'

const prettyLabel = (name) =>
  String(name)
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')

const selectStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 8px)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  padding: '0.25rem 0.4rem',
  fontSize: 13,
}

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }

// The bare controls (labeled rows) — rendered both standalone and teleported.
function ThemeControls() {
  const { themeName, names, setTheme, appearance, appearances, setAppearance } = useTheme()
  return (
    <>
      <label style={rowStyle}>
        <span style={{ color: 'var(--color-muted)' }}>Appearance</span>
        <select value={appearance} onChange={(e) => setAppearance(e.target.value)} style={selectStyle}>
          {appearances.map((a) => (
            <option key={a} value={a}>
              {prettyLabel(a)}
            </option>
          ))}
        </select>
      </label>
      {names.length > 1 && (
        <label style={rowStyle}>
          <span style={{ color: 'var(--color-muted)' }}>Theme</span>
          <select value={themeName} onChange={(e) => setTheme(e.target.value)} style={selectStyle}>
            {names.map((n) => (
              <option key={n} value={n}>
                {prettyLabel(n)}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )
}

export function ThemePicker() {
  const slot = useToolbarSlot()
  if (slot === undefined) return null // pending: don't flash standalone before we know
  // Installed alongside vike-toolbar -> teleport the live controls into its popover.
  if (slot) return createPortal(<ThemeControls />, slot)
  // No toolbar -> the standalone fixed picker (bottom-right).
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        insetInlineEnd: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '0.6rem 0.7rem',
        borderRadius: 'var(--radius, 10px)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
      }}
    >
      <ThemeControls />
    </div>
  )
}
