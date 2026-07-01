// The card block: a static CONTAINER block — a bordered, padded surface with an optional header
// (title + description) and footer, wrapping a nested composition of blocks. The most-used building
// block. Unlike tabs/accordion it holds no live UI state; it's a plain themed box. Colors/radius
// read vike-themes CSS vars, so a theme restyles every card for free. Cards compose recursively.
import { definePage, card, heading, text, badge, button, divider } from 'vike-blocks'
import { Page } from 'vike-blocks/react'
import { callout } from '../callout.block.jsx'

const page = definePage({
  sections: [
    heading('Card block').level(1),
    text('A theme-native surface that groups related content — border, radius, padding, an optional header and footer. Each card is itself a composition of blocks.').tone('muted'),

    heading('Basic').level(3),
    text('A card with a title, a description, and body blocks.').tone('muted'),
    card([text('Invite teammates to collaborate on this workspace. They can view and edit shared views.')])
      .title('Team members')
      .description('Manage who has access to this workspace.'),

    heading('With a footer').level(3),
    text('A header, body, and a footer — the footer holds its own blocks (here, buttons).').tone('muted'),
    card([
      text('Your plan renews on the 1st of every month. Update your payment method or change plans at any time.'),
      badge('Pro plan').tone('info'),
    ])
      .title('Billing')
      .description('You are on the Pro plan.')
      .footer([button('Manage plan').variant('primary'), button('Cancel').variant('ghost')]),

    heading('Composition all the way down').level(3),
    text('A card can hold any blocks, including custom ones and other cards.').tone('muted'),
    card([
      text('Cards nest — the container/resolve-recursively pattern the tabs and accordion blocks use.'),
      divider(),
      callout('A callout inside a card').tone('warn').body('Any block composes inside a card.'),
      card([text('An inner card, one level down.')]).title('Nested card'),
    ]).title('Nesting'),
  ],
})

export default function CardPage() {
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Page page={page} />
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/">{'<-'} back to catalog</a>
      </p>
    </div>
  )
}
