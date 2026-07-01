// The accordion block: a CONTAINER block like tabs, but expand/collapse instead of switch. `accordion()`
// composes items, each a composition of other blocks (including the custom callout). Which items are
// open is local UI state; the panel height morphs (measured, CSS-transitioned) and fades — no
// animation library, same in React and Vue. Colors/radius read vike-themes CSS vars.
import { definePage, accordion, heading, text, badge } from 'vike-blocks'
import { Page } from 'vike-blocks/react'
import { callout } from '../callout.block.jsx'

const page = definePage({
  sections: [
    heading('Accordion block').level(1),
    text('An interactive, theme-native accordion — expand/collapse sections with an animated height morph. Each panel is itself a composition of blocks.').tone('muted'),

    heading('Single-open (FAQ)').level(3),
    text('Opening one section closes the others. Every section is collapsible — click an open one to close it.').tone('muted'),
    accordion()
      .item('overview', 'What is a block?', [
        text('A block is one section of a page — a { block, ...props } descriptor. A page is a composition of blocks, and a container block (tabs, accordion) holds nested blocks.'),
        badge('theme-native').tone('info'),
      ])
      .item('nested', 'Can a panel hold custom blocks?', [
        text('Yes — a panel holds any blocks, including custom ones:'),
        callout('A callout inside an accordion').tone('warn').body('Composition all the way down — accordion is a container block.'),
      ])
      .item('animation', 'How does it animate without a library?', [
        text('The panel measures its natural height, then CSS-transitions between 0 and that height while fading in. The same zero-dependency technique the tabs block uses.'),
      ])
      .defaultValue('overview'),

    heading('Multi-open').level(3),
    text('Several sections can be open at once (mode set with .multiple()).').tone('muted'),
    accordion()
      .multiple()
      .item('shipping', 'Shipping', [text('Ships in 2-3 business days.')])
      .item('returns', 'Returns', [text('30-day returns, no questions asked.')])
      .item('warranty', 'Warranty', [text('One-year limited warranty on all parts.')])
      .defaultValue(['shipping', 'returns']),
  ],
})

export default function AccordionPage() {
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Page page={page} />
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/">{'<-'} back to catalog</a>
      </p>
    </div>
  )
}
