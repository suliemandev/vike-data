// The Vue renderer for the `alert` block — the Vue twin of react/AlertView.jsx. Theme-native (accent
// is a vike-themes CSS var per intent, tint is a color-mix over the background). A functional
// component (no state), like the other leaf renderers.
import { h } from 'vue'
import { registerBlockRenderer } from './registry.js'

const INTENTS = {
  info: { accent: 'var(--color-primary, #2563eb)', icon: 'i' },
  success: { accent: 'var(--color-success, #16a34a)', icon: '✓' },
  warning: { accent: 'var(--color-warning, #d97706)', icon: '!' },
  danger: { accent: 'var(--color-danger, #dc2626)', icon: '✕' },
}
const ALIASES = { warn: 'warning', error: 'danger', note: 'info' }

export const AlertView = (props) => {
  const it = INTENTS[ALIASES[props.intent] ?? props.intent] ?? INTENTS.info
  const icon = h(
    'span',
    {
      'aria-hidden': 'true',
      style: {
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '999px',
        border: '1.5px solid currentColor',
        color: it.accent,
        fontSize: '12px',
        fontWeight: 700,
        lineHeight: 1,
      },
    },
    it.icon,
  )
  const content = h('div', [
    props.title ? h('strong', { style: { display: 'block', color: it.accent, fontSize: '14px' } }, props.title) : null,
    props.body ? h('p', { style: { margin: props.title ? '0.2rem 0 0' : 0, fontSize: '14px', color: 'var(--color-muted, #475569)', lineHeight: 1.5 } }, props.body) : null,
  ])
  return h(
    'div',
    {
      role: 'note',
      'data-slot': 'alert',
      style: {
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'flex-start',
        padding: '0.75rem 0.9rem',
        margin: '0.6rem 0',
        borderRadius: 'var(--radius, 8px)',
        background: `color-mix(in srgb, ${it.accent} 10%, var(--color-bg, #ffffff))`,
        color: 'var(--color-text, #0f172a)',
      },
    },
    [icon, content],
  )
}
AlertView.props = ['title', 'intent', 'body']

registerBlockRenderer('alert', AlertView)
