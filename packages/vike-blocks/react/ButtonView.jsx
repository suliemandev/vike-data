// The React renderer for the `button` block. Theme-native (every color / radius is a vike-themes
// CSS var). `to` renders an <a> styled as a button (declarative nav); otherwise a real <button>.
import { registerBlockRenderer } from './registry.js'

const VARIANTS = {
  primary: { background: 'var(--color-primary, #2563eb)', color: 'var(--color-primary-text, #ffffff)', borderColor: 'transparent' },
  secondary: { background: 'var(--color-surface, #f1f5f9)', color: 'var(--color-text, #0f172a)', borderColor: 'var(--color-border, #e2e8f0)' },
  ghost: { background: 'transparent', color: 'var(--color-text, #0f172a)', borderColor: 'transparent' },
  danger: { background: 'var(--color-danger, #dc2626)', color: '#ffffff', borderColor: 'transparent' },
}

function buttonStyle(variant, size) {
  const v = VARIANTS[variant] ?? VARIANTS.primary
  return {
    display: 'inline-block',
    padding: size === 'sm' ? '0.3rem 0.7rem' : '0.5rem 1rem',
    fontSize: size === 'sm' ? 13 : 14,
    fontWeight: 500,
    lineHeight: 1.2,
    borderRadius: 'var(--radius, 8px)',
    border: `1px solid ${v.borderColor}`,
    background: v.background,
    color: v.color,
    cursor: 'pointer',
    textDecoration: 'none',
  }
}

export function ButtonView({ label, variant = 'primary', to, size = 'md' }) {
  const style = buttonStyle(variant, size)
  return to ? (
    <a href={to} style={style}>{label}</a>
  ) : (
    <button type="button" style={style}>{label}</button>
  )
}

registerBlockRenderer('button', ButtonView)
