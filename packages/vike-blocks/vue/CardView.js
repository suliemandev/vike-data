// The Vue renderer for the `card` block — the Vue twin of react/CardView.jsx. A static, functional
// component (no setup/state — a card doesn't animate or hold UI state), theme-native (vike-themes
// CSS vars with fallbacks): a bordered, rounded, padded surface with an optional header (title +
// muted description) and footer, each divided from the body. The body and footer resolved sections
// are drawn with <Blocks>.
import { h } from 'vue'
import { Blocks } from './Blocks.js'
import { registerBlockRenderer } from './registry.js'

export const CardView = {
  props: ['title', 'description', 'sections', 'footer'],
  setup(props) {
    return () => {
      const hasHeader = props.title != null || props.description != null
      const children = []

      if (hasHeader) {
        const headerKids = []
        if (props.title != null) headerKids.push(h('div', { style: { fontSize: '16px', fontWeight: 600, lineHeight: 1.3 } }, props.title))
        if (props.description != null) {
          headerKids.push(
            h(
              'div',
              { style: { marginTop: props.title != null ? '4px' : '0', fontSize: '14px', color: 'var(--color-muted, #64748b)', lineHeight: 1.5 } },
              props.description,
            ),
          )
        }
        children.push(
          h('div', { 'data-slot': 'card-header', style: { padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border, #e2e8f0)' } }, headerKids),
        )
      }

      children.push(h('div', { 'data-slot': 'card-body', style: { padding: '1.25rem' } }, h(Blocks, { sections: props.sections ?? [] })))

      if (props.footer && props.footer.length > 0) {
        children.push(
          h(
            'div',
            {
              'data-slot': 'card-footer',
              style: { padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border, #e2e8f0)', background: 'var(--color-bg, transparent)' },
            },
            h(Blocks, { sections: props.footer }),
          ),
        )
      }

      return h(
        'div',
        {
          'data-slot': 'card',
          style: {
            marginTop: '0.75rem',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: 'var(--radius, 12px)',
            background: 'var(--color-surface, #ffffff)',
            color: 'var(--color-text, #0f172a)',
            overflow: 'hidden',
          },
        },
        children,
      )
    }
  },
}

registerBlockRenderer('card', CardView)
