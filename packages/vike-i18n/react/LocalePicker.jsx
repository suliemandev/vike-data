// The runtime locale switcher: lists every locale any installed extension provides;
// switching re-renders all t() strings live and persists via cookie.
//
// Placement composes with vike-toolbar: when a toolbar is installed, the control
// TELEPORTS into its shared popover (#vike-toolbar-items) so all settings live in one
// place; with no toolbar it renders standalone (fixed, bottom-left). The control renders
// inside this extension's LocaleProvider either way, so switching stays live — the portal
// moves the DOM, not the React tree.
import { createPortal } from 'react-dom'
import { useTranslation } from './context.js'
import { useToolbarSlot } from './useToolbarSlot.js'

const LABELS = { en: 'English', fr: 'Français', ar: 'العربية', es: 'Español', de: 'Deutsch' }

const selectStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 8px)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  padding: '0.25rem 0.4rem',
  fontSize: 13,
}

function LocaleControl() {
  const { locale, locales, setLocale } = useTranslation()
  if (!locales || locales.length < 2) return null
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--color-muted)' }}>Language</span>
      <select value={locale} onChange={(e) => setLocale(e.target.value)} style={selectStyle}>
        {locales.map((l) => (
          <option key={l} value={l}>
            {LABELS[l] || l}
          </option>
        ))}
      </select>
    </label>
  )
}

export function LocalePicker() {
  const slot = useToolbarSlot()
  if (slot === undefined) return null // pending: don't flash standalone before we know
  // Installed alongside vike-toolbar -> teleport the live control into its popover.
  if (slot) return createPortal(<LocaleControl />, slot)
  // No toolbar -> standalone fixed picker (bottom-left, clearing the theme picker).
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        insetInlineStart: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0.45rem 0.6rem',
        borderRadius: 'var(--radius, 10px)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      <LocaleControl />
    </div>
  )
}
