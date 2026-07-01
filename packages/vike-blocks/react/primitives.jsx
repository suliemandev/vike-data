// The React components for the built-in leaf blocks, registered against their block types.
// Each receives the block's resolved view-model as props (for a pass-through block that IS its
// descriptor props, e.g. text -> { value, tone }). No React import — vike-react uses the
// automatic JSX runtime, matching the rest of the family. Importing this module registers the
// built-ins as a side effect (Blocks.jsx imports it for exactly that).
import { registerBlockRenderer } from './registry.js'

const TONE = { muted: 'var(--color-muted)', danger: 'var(--color-danger, #dc2626)', success: 'var(--color-success, #16a34a)', info: 'var(--color-primary, #2563eb)' }

export function Text({ value, tone }) {
  return <span style={{ color: tone ? (TONE[tone] ?? 'inherit') : 'var(--color-text, inherit)' }}>{value}</span>
}

export function Heading({ value, level = 2 }) {
  const Tag = `h${Math.min(6, Math.max(1, level))}`
  return <Tag style={{ margin: '0 0 0.5rem' }}>{value}</Tag>
}

export function Badge({ value, tone }) {
  const color = tone ? (TONE[tone] ?? 'var(--color-muted)') : 'var(--color-muted)'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, border: `1px solid ${color}`, color }}>
      {value}
    </span>
  )
}

export function Divider() {
  return <hr style={{ border: 0, borderTop: '1px solid var(--color-border)', margin: '1rem 0' }} />
}

export function Link({ label, to, tone }) {
  return (
    <a href={to} style={{ color: tone ? (TONE[tone] ?? 'var(--color-primary)') : 'var(--color-primary, #2563eb)' }}>
      {label}
    </a>
  )
}

// Markdown MVP: render the source in a pre-wrapped block. A real markdown renderer is an app/
// extension concern (registerBlockRenderer('markdown', ...) swaps this); this keeps zero deps.
export function Markdown({ source }) {
  return <div style={{ whiteSpace: 'pre-wrap' }}>{source}</div>
}

// A stat card. `value` is shown when present; `source` is an expression the app/data layer
// evaluates (not evaluated here), so it falls back to an em dash until wired.
export function Stat({ title, value }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius, 10px)', padding: '1rem' }}>
      <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text)' }}>{value ?? '—'}</div>
    </div>
  )
}

registerBlockRenderer('text', Text)
registerBlockRenderer('heading', Heading)
registerBlockRenderer('badge', Badge)
registerBlockRenderer('divider', Divider)
registerBlockRenderer('link', Link)
registerBlockRenderer('markdown', Markdown)
registerBlockRenderer('stat', Stat)
