// A small fixed-position dark/light toggle, available on every page. Reads the
// active theme + toggle() from vike-react-themes' context.
import { useTheme } from 'vike-react-themes'

export function ThemeToggle() {
  const { name, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        position: 'fixed',
        bottom: 16,
        insetInlineEnd: 16,
        padding: '0.45rem 0.75rem',
        borderRadius: 'var(--radius, 10px)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {name === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}
