// A toolbar setting the APP contributes (#121 demo): the theme appearance toggle, in
// the toolbar popover instead of a bespoke floating widget. The app is the right owner
// (it knows about BOTH vike-themes and vike-toolbar), so the dependency arrows stay
// pointing inward, exactly like the app contributes its `adminResources` and brand theme.
//
// It drives vike-themes through its PUBLIC cookie contract (`vike_appearance`, read by
// vike-themes/oncreate on every request) rather than its React context. That keeps the
// control decoupled from where the toolbar Wrapper sits in the provider tree — a toolbar
// aggregates settings from many extensions, so it can't assume it renders inside any one
// extension's provider. Setting the cookie + reloading re-resolves the theme server-side.
import { useState } from 'react'

const APPEARANCES = ['system', 'light', 'dark']

const readCookie = (name) => {
  if (typeof document === 'undefined') return null
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie)
  return m ? decodeURIComponent(m[1]) : null
}

const selectStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 8px)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  padding: '0.2rem 0.35rem',
  fontSize: 13,
}

const pretty = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function AppearanceSetting() {
  const [value, setValue] = useState(() => readCookie('vike_appearance') || 'system')
  const onChange = (e) => {
    const next = e.target.value
    setValue(next)
    // Same cookie vike-themes' own picker writes; reload so oncreate re-resolves it.
    document.cookie = `vike_appearance=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
    window.location.reload()
  }
  return (
    <select value={value} onChange={onChange} style={selectStyle} aria-label="Appearance">
      {APPEARANCES.map((a) => (
        <option key={a} value={a}>
          {pretty(a)}
        </option>
      ))}
    </select>
  )
}
