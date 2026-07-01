// The Vue components for the built-in leaf elements, registered against their block types. The
// Vue twin of vike-elements/react/elements.jsx. Written as functional components (a function of
// props with an explicit `.props` list) — the closest Vue analog to React's function components,
// so no .vue compile step and the same shape as the React side. Each receives the block's
// resolved view-model as props. Importing this module registers the built-ins as a side effect.
import { h } from 'vue'
import { registerElementRenderer } from './registry.js'

const TONE = { muted: 'var(--color-muted)', danger: 'var(--color-danger, #dc2626)', success: 'var(--color-success, #16a34a)', info: 'var(--color-primary, #2563eb)' }

export const Text = (props) => h('span', { style: { color: props.tone ? (TONE[props.tone] ?? 'inherit') : 'var(--color-text, inherit)' } }, props.value)
Text.props = ['value', 'tone']

export const Heading = (props) => {
  const level = Math.min(6, Math.max(1, props.level ?? 2))
  return h(`h${level}`, { style: { margin: '0 0 0.5rem' } }, props.value)
}
Heading.props = ['value', 'level']

export const Badge = (props) => {
  const color = props.tone ? (TONE[props.tone] ?? 'var(--color-muted)') : 'var(--color-muted)'
  return h('span', { style: { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', border: `1px solid ${color}`, color } }, props.value)
}
Badge.props = ['value', 'tone']

export const Divider = () => h('hr', { style: { border: 0, borderTop: '1px solid var(--color-border)', margin: '1rem 0' } })
Divider.props = []

export const Link = (props) => h('a', { href: props.to, style: { color: props.tone ? (TONE[props.tone] ?? 'var(--color-primary)') : 'var(--color-primary, #2563eb)' } }, props.label)
Link.props = ['label', 'to', 'tone']

export const Markdown = (props) => h('div', { style: { whiteSpace: 'pre-wrap' } }, props.source)
Markdown.props = ['source']

export const Stat = (props) =>
  h('div', { style: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius, 10px)', padding: '1rem' } }, [
    h('div', { style: { color: 'var(--color-muted)', fontSize: '13px' } }, props.title),
    h('div', { style: { fontSize: '24px', fontWeight: 600, color: 'var(--color-text)' } }, props.value ?? '—'),
  ])
Stat.props = ['title', 'value']

registerElementRenderer('text', Text)
registerElementRenderer('heading', Heading)
registerElementRenderer('badge', Badge)
registerElementRenderer('divider', Divider)
registerElementRenderer('link', Link)
registerElementRenderer('markdown', Markdown)
registerElementRenderer('stat', Stat)
