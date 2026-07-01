// The dialog block: the catalog's most interactive built-in. `dialog()` composes a modal from a
// trigger, a title/description, and a body of nested blocks (including the custom callout). Opening
// is local UI state; the renderer does the portal, backdrop, focus trap, Escape / outside-click to
// close, and scroll-lock itself — dep-free, with a CSS fade + scale. Colors/radius read vike-themes
// CSS vars.
import { definePage, dialog, heading, text, button } from 'vike-blocks'
import { Page } from 'vike-blocks/react'
import { callout } from '../callout.block.jsx'

const page = definePage({
  sections: [
    heading('Dialog block').level(1),
    text('An interactive, theme-native modal — a trigger opens an overlay that holds a composition of blocks. Focus trap, Escape, outside-click, and scroll-lock are all built in, dep-free.').tone('muted'),

    heading('Confirm dialog').level(3),
    text('A trigger button opens the modal. Press Escape, click the backdrop, or the × to close.').tone('muted'),
    dialog()
      .title('Delete post')
      .description('This action cannot be undone.')
      .trigger('Delete post')
      .sections([
        text('The post and all of its comments will be permanently removed.'),
        callout('Heads up').tone('warn').body('A confirm button that actually deletes is the actions axis (a later block) — here the footer buttons are just composition.'),
      ])
      .footer([button('Cancel').variant('ghost'), button('Delete').variant('danger')]),

    heading('Nested blocks').level(3),
    text('A dialog body holds any blocks, so dialogs compose recursively like tabs and accordion.').tone('muted'),
    dialog()
      .title('About blocks')
      .trigger('Learn more')
      .sections([
        heading('Composable UI as data').level(4),
        text('A page is a composition of blocks. A container block (tabs, accordion, dialog) holds nested blocks, resolved recursively.'),
      ]),
  ],
})

export default function DialogPage() {
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Page page={page} />
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/">{'<-'} back to catalog</a>
      </p>
    </div>
  )
}
