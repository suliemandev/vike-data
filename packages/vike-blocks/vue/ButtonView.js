// The Vue renderer for the `button` block — the Vue twin of react/ButtonView.jsx. Theme-native;
// `to` renders an <a> styled as a button, otherwise a real <button>. A functional component (no
// state), like the other leaf renderers.
import { h } from 'vue'
import { registerBlockRenderer } from './registry.js'

const VARIANTS = {
  primary: { background: 'var(--color-primary, #2563eb)', color: 'var(--color-primary-text, #ffffff)', borderColor: 'transparent' },
  secondary: { background: 'var(--color-surface, #f1f5f9)', color: 'var(--color-text, #0f172a)', borderColor: 'var(--color-border, #e2e8f0)' },
  ghost: { background: 'transparent', color: 'var(--color-text, #0f172a)', borderColor: 'transparent' },
  danger: { background: 'var(--color-danger, #dc2626)', color: '#ffffff', borderColor: 'transparent' },
}

export const ButtonView = (props) => {
  const variant = props.variant ?? 'primary'
  const size = props.size ?? 'md'
  const v = VARIANTS[variant] ?? VARIANTS.primary
  const style = {
    display: 'inline-block',
    padding: size === 'sm' ? '0.3rem 0.7rem' : '0.5rem 1rem',
    fontSize: size === 'sm' ? '13px' : '14px',
    fontWeight: 500,
    lineHeight: 1.2,
    borderRadius: 'var(--radius, 8px)',
    border: `1px solid ${v.borderColor}`,
    background: v.background,
    color: v.color,
    cursor: 'pointer',
    textDecoration: 'none',
  }
  return props.to ? h('a', { href: props.to, style }, props.label) : h('button', { type: 'button', style }, props.label)
}
ButtonView.props = ['label', 'variant', 'to', 'size']

registerBlockRenderer('button', ButtonView)
