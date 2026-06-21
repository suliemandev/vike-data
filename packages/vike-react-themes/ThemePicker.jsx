// The runtime theme switcher (fixed, bottom-right) — the optional runtime layer
// on top of the configured default. Lists every registered theme and switches the
// active one live (persisted via cookie). Ships with vike-react-themes so an app
// that installs themes gets the picker for free; labels are derived from the
// theme name (`emerald-dark` -> `Emerald · Dark`).
import { useTheme } from './ThemeProvider.jsx'

const prettyLabel = (name) =>
  String(name)
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' · ')

export function ThemePicker() {
  const { name, names, setTheme } = useTheme()
  if (!names || names.length < 2) return null
  return (
    <label
      style={{
        position: 'fixed',
        bottom: 16,
        insetInlineEnd: 16,
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
      <span style={{ color: 'var(--color-muted)' }}>Theme</span>
      <select
        value={name}
        onChange={(e) => setTheme(e.target.value)}
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius, 8px)',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          padding: '0.25rem 0.4rem',
          fontSize: 13,
        }}
      >
        {names.map((n) => (
          <option key={n} value={n}>
            {prettyLabel(n)}
          </option>
        ))}
      </select>
    </label>
  )
}
