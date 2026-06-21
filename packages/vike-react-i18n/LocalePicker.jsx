// The runtime locale switcher (fixed, bottom-left so it clears the theme picker
// on the right). Lists every locale any installed extension provides; switching
// re-renders all t() strings live and persists via cookie.
import { useTranslation } from './LocaleProvider.jsx'

const LABELS = { en: 'English', fr: 'Français', ar: 'العربية', es: 'Español', de: 'Deutsch' }

export function LocalePicker() {
  const { locale, locales, setLocale } = useTranslation()
  if (!locales || locales.length < 2) return null
  return (
    <label
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
      <span style={{ color: 'var(--color-muted)' }}>Language</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius, 8px)',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          padding: '0.25rem 0.4rem',
          fontSize: 13,
        }}
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {LABELS[l] || l}
          </option>
        ))}
      </select>
    </label>
  )
}
