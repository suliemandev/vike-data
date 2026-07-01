// The React renderer for the `alert` block. Theme-native: the accent is a vike-themes CSS var per
// intent, and the tint is a color-mix of that accent over the background (falls back to just the
// accent border + icon where color-mix is unsupported). A leaf, no state.
import { registerBlockRenderer } from './registry.js'

const INTENTS = {
  info: { accent: 'var(--color-primary, #2563eb)', icon: 'i' },
  success: { accent: 'var(--color-success, #16a34a)', icon: '✓' },
  warning: { accent: 'var(--color-warning, #d97706)', icon: '!' },
  danger: { accent: 'var(--color-danger, #dc2626)', icon: '✕' },
}
// Forgiving aliases so warn/error/note resolve to a known intent.
const ALIASES = { warn: 'warning', error: 'danger', note: 'info' }

const iconStyle = (accent) => ({
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: 999,
  border: '1.5px solid currentColor',
  color: accent,
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
})

export function AlertView({ title, intent = 'info', body }) {
  const it = INTENTS[ALIASES[intent] ?? intent] ?? INTENTS.info
  return (
    <div
      role="note"
      data-slot="alert"
      style={{
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'flex-start',
        padding: '0.75rem 0.9rem',
        margin: '0.6rem 0',
        borderRadius: 'var(--radius, 8px)',
        background: `color-mix(in srgb, ${it.accent} 10%, var(--color-bg, #ffffff))`,
        color: 'var(--color-text, #0f172a)',
      }}
    >
      <span aria-hidden="true" style={iconStyle(it.accent)}>
        {it.icon}
      </span>
      <div>
        {title && <strong style={{ display: 'block', color: it.accent, fontSize: 14 }}>{title}</strong>}
        {body && <p style={{ margin: title ? '0.2rem 0 0' : 0, fontSize: 14, color: 'var(--color-muted, #475569)', lineHeight: 1.5 }}>{body}</p>}
      </div>
    </div>
  )
}

registerBlockRenderer('alert', AlertView)
