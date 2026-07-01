// The React renderer for the `card` block. A static, theme-native surface: a border + radius +
// padding box on the `var(--color-*)` contract (with fallbacks), so a theme restyles it for free.
// An optional header (title + muted description) sits above the body with a divider; an optional
// footer sits below with a divider. The body and footer resolved sections are drawn with <Blocks>,
// so a card can hold any blocks. No state, no animation — a card is static.
import { Blocks } from './Blocks.jsx'
import { registerBlockRenderer } from './registry.js'

export function CardView({ title, description, sections = [], footer }) {
  const hasHeader = title != null || description != null
  return (
    <div
      data-slot="card"
      style={{
        marginTop: '0.75rem',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 'var(--radius, 12px)',
        background: 'var(--color-surface, #ffffff)',
        color: 'var(--color-text, #0f172a)',
        overflow: 'hidden',
      }}
    >
      {hasHeader && (
        <div data-slot="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
          {title != null && <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>}
          {description != null && (
            <div style={{ marginTop: title != null ? 4 : 0, fontSize: 14, color: 'var(--color-muted, #64748b)', lineHeight: 1.5 }}>{description}</div>
          )}
        </div>
      )}
      <div data-slot="card-body" style={{ padding: '1.25rem' }}>
        <Blocks sections={sections} />
      </div>
      {footer && footer.length > 0 && (
        <div
          data-slot="card-footer"
          style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border, #e2e8f0)', background: 'var(--color-bg, transparent)' }}
        >
          <Blocks sections={footer} />
        </div>
      )}
    </div>
  )
}

registerBlockRenderer('card', CardView)
