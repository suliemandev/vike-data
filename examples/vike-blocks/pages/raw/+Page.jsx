// Authoring style 2: PLAIN DESCRIPTORS. The builders on the home page are just sugar — a block is
// a plain `{ block: 'type', ...props }` object, which is what a data source or a generator would
// emit. Here we hand-write the descriptors, `resolvePage` turns them into view-models, and
// `<Blocks>` draws them. Importing ./callout.block registers the custom block + its renderer.
import { resolvePage } from 'vike-blocks'
import { Blocks } from 'vike-blocks/react'
import '../callout.block.jsx'

const sections = [
  { block: 'heading', value: 'vike-blocks (plain descriptors)', level: 1 },
  { block: 'text', value: 'The exact same page as the home route, authored as data instead of with fluent builders.', tone: 'muted' },
  { block: 'badge', value: 'descriptors', tone: 'info' },
  { block: 'divider' },
  { block: 'callout', title: 'A block is just data', tone: 'info', body: 'This is the { block, ...props } shape the builders collapse to. Because it is plain data, a page can be stored, generated, or streamed — not only written by hand.' },
  { block: 'callout', title: 'Same renderer', tone: 'warn', body: 'The custom callout renders identically here — resolvePage + <Blocks> is the low-level path that <Page> wraps.' },
  { block: 'divider' },
  { block: 'link', label: '<- back to the fluent-builder version', to: '/' },
]

export default function RawPage() {
  const resolved = resolvePage({ sections })
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Blocks sections={resolved.sections} />
    </div>
  )
}
