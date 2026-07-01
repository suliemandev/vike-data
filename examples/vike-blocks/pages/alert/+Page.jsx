// The alert block: a leaf, tone-styled notice. `alert(title).intent(...).body(...)` renders a themed
// callout — the accent per intent reads a vike-themes CSS var, and the tint is a color-mix over the
// background, so a theme recolors the whole set. The example's custom `callout` block (pages/
// callout.block.jsx) stays the "third-party block" teaching demo; this is the built-in.
import { definePage, alert, heading, text } from 'vike-blocks'
import { Page } from 'vike-blocks/react'

const page = definePage({
  sections: [
    heading('Alert block').level(1),
    text('A leaf, theme-native notice in four intents. Static and dep-free; colors read vike-themes variables.').tone('muted'),

    heading('Intents').level(3),
    alert('Did you know?').intent('info').body('Info is the default intent — use it for neutral, helpful context.'),
    alert('Saved').intent('success').body('Your changes were saved successfully.'),
    alert('Heads up').intent('warning').body('Your trial ends in 3 days. Add a card to keep your data.'),
    alert('Something went wrong').intent('danger').body('We could not process the payment. Please try again.'),

    heading('Title only / body only').level(3),
    alert('A one-line notice with no body.').intent('info'),
  ],
})

export default function AlertPage() {
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Page page={page} />
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/">{'<-'} back to catalog</a>
      </p>
    </div>
  )
}
