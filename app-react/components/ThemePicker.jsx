// A visible theme switcher (fixed, bottom-right). Lists every theme the app
// composed in theme/themes.js — built-ins, the installed emerald package, and the
// custom Acme brand — and switches the active one live. Selecting a theme calls
// setTheme(name) from vike-react-themes; the whole UI restyles because every
// component authors against the theme's CSS variables.
import { useTheme } from 'vike-react-themes'
import { themeLabels } from '../theme/themes.js'

export function ThemePicker() {
  const { name, names, setTheme } = useTheme()
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
            {themeLabels[n] || n}
          </option>
        ))}
      </select>
    </label>
  )
}
