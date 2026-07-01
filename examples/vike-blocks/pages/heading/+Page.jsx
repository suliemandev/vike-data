// The heading block: a leaf block with six levels. `heading(value).level(n)` renders an <h1>..<h6>.
// The top margin scales with the level, so a page-title h1 sits flush at the top while an h2/h3
// section heading separates from the block above it — sections breathe without any per-page spacing.
// Colors are theme-native (headings inherit the theme text color).
import { definePage, heading, text } from 'vike-blocks'
import { Page } from 'vike-blocks/react'

const page = definePage({
  sections: [
    heading('Heading block').level(1),
    text('Six levels, h1 through h6. The top margin scales with the level, so section headings separate from the block above them while the page title stays flush at the top.').tone('muted'),

    heading('Section (h2)').level(2),
    text('An h2 gets the most top space — it reads as a new section after the text above it.'),

    heading('Subsection (h3)').level(3),
    text('An h3 gets a little less, nested under its section.'),

    heading('Minor heading (h4)').level(4),
    text('h4 and below share a smaller top margin.'),

    heading('h5').level(5),
    heading('h6').level(6),
  ],
})

export default function HeadingPage() {
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Page page={page} />
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/">{'<-'} back to catalog</a>
      </p>
    </div>
  )
}
