// The runtime switcher (fixed, bottom-right): two controls for the two axes —
// Appearance (System / Light / Dark) and Theme (the registered brands, shown only
// when there is more than one). Both switch live and persist via cookie.
import { useTheme } from './context.js'

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

export function ThemePicker() {
  const { themeName, names, setTheme, appearance, appearances, setAppearance } = useTheme()
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
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
    </div>
  )
}
