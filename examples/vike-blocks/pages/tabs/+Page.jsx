// The tabs block: the first INTERACTIVE built-in. `tabs()` composes panels, each a composition of
// other blocks (including the custom callout). Switching tabs is local UI state; the sliding
// highlight is pure CSS; colors/radius read vike-themes CSS vars.
import { definePage, tabs, heading, text, badge } from 'vike-blocks'
import { Page } from 'vike-blocks/react'
import { callout } from '../callout.block.jsx'

const page = definePage({
  sections: [
    heading('Tabs block').level(1),
    text('An interactive, theme-native tabs block — the first built-in with client state. Each panel is itself a composition of blocks.').tone('muted'),
    tabs()
      .tab('overview', 'Overview', [
        heading('Overview').level(3),
        text('Switching tabs is local UI state (no data action). The highlight slides via pure CSS — no animation library, and it works the same in React and Vue.'),
        badge('theme-native').tone('info'),
      ])
      .tab('nested', 'Nested blocks', [
        text('A panel holds any blocks, including custom ones:'),
        callout('A callout inside a tab').tone('warn').body('Composition all the way down — tabs is a container block.'),
      ])
      .tab('theming', 'Theming', [
        text('Colors and radius read vike-themes variables (--color-surface / --color-primary / --radius), so a theme restyles the whole catalog for free.'),
      ])
      .defaultValue('overview'),
  ],
})

export default function TabsPage() {
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Page page={page} />
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/">{'<-'} back to catalog</a>
      </p>
    </div>
  )
}
