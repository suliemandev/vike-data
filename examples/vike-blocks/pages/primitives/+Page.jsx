// The leaf primitives + a custom block, composed with fluent builders. `definePage({ sections })`
// composes a page out of blocks; each section is a builder whose `.build()` collapses to a
// descriptor. `<Page>` resolves the page and draws each block with its registered renderer —
// importing ./callout.block registers the custom one alongside the built-ins.
import { definePage, heading, text, badge, divider, link } from 'vike-blocks'
import { Page } from 'vike-blocks/react'
import { callout } from '../callout.block.jsx'

const page = definePage({
  sections: [
    heading('Primitives').level(1),
    text('A page is a composition of BLOCKS — a UI schema, separate from any data schema. These are the built-in leaf primitives; the boxes below are a custom block defined in this app.').tone('muted'),
    badge('primitives').tone('info'),
    divider(),
    callout('What is a block?')
      .tone('info')
      .body('A { block: "type", ...props } descriptor. definePage composes them into a page; a per-framework renderer draws each one. No layout DSL — just typed sections.'),
    callout('Custom blocks are peers')
      .tone('warn')
      .body('The callout is not built in — it was created with defineBlock() + registerBlockRenderer() in ./callout.block.jsx. Your block composes exactly like heading/text/badge.'),
    divider(),
    text('The same page can also be authored as plain { block, ...props } descriptors:').tone('muted'),
    link('See the plain-descriptor version ->').to('/raw'),
  ],
})

export default function PrimitivesPage() {
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Page page={page} />
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/">{'<-'} back to catalog</a>
      </p>
    </div>
  )
}
