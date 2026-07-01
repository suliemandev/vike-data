// A CUSTOM block, defined and rendered entirely in the app — the proof that a third-party block
// is a peer of the built-ins, not a special case. Two halves, the same shape every block has:
//   1. the agnostic authoring seam: `defineBlock(type, { build, refine })` gives a fluent builder
//      whose `.build()` collapses to a `{ block: 'callout', ...props }` descriptor.
//   2. the per-framework renderer: `registerBlockRenderer(type, Component)` binds the React
//      component that draws a resolved `callout` (it receives the descriptor's props).
// Both pages import this module, so the block + its renderer are registered once and reused.
import { defineBlock } from 'vike-blocks'
import { registerBlockRenderer } from 'vike-blocks/react'

// callout('Heads up').tone('warn').body('...')  ->  { block: 'callout', title, tone, body }
export const callout = defineBlock('callout', {
  build: (title) => ({ title }),
  refine: {
    tone: (token) => ({ tone: token }),
    body: (text) => ({ body: text }),
  },
})

const TONES = {
  info: { border: '#3b82f6', title: '#1d4ed8' },
  warn: { border: '#f59e0b', title: '#b45309' },
  danger: { border: '#ef4444', title: '#b91c1c' },
}

registerBlockRenderer('callout', ({ title, tone = 'info', body }) => {
  const c = TONES[tone] ?? TONES.info
  return (
    <div style={{ borderLeft: `3px solid ${c.border}`, background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 6, margin: '0.6rem 0' }}>
      <strong style={{ color: c.title }}>{title}</strong>
      {body && <p style={{ margin: '0.3rem 0 0', color: '#334155', lineHeight: 1.5 }}>{body}</p>}
    </div>
  )
})
