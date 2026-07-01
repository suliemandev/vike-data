// The Vue renderer for the `tabs` block — the Vue twin of react/TabsView.jsx. A stateful component
// (a `setup` with refs, unlike the pass-through primitives which are functional), theme-native
// (vike-themes CSS vars), with the same pure-CSS sliding highlight, a fade-in on the swapped panel,
// and a measured height morph on the panel area. Each panel's resolved sections are drawn with
// <Blocks>. Zero animation dependency.
import { h, ref, watch, nextTick, onMounted } from 'vue'
import { Blocks } from './Blocks.js'
import { registerBlockRenderer } from './registry.js'

export const TabsView = {
  props: ['tabs', 'activeValue'],
  setup(props) {
    const active = ref(props.activeValue ?? props.tabs?.[0]?.value)
    const contentEl = ref(null)
    const height = ref(null)

    const measure = () => {
      if (contentEl.value) height.value = contentEl.value.offsetHeight
    }
    onMounted(measure)
    // Re-measure after the panel content swaps (auto -> px on first run is instant; px -> px animates).
    watch(active, () => nextTick(measure))

    return () => {
      const tabs = props.tabs ?? []
      const n = tabs.length || 1
      const index = Math.max(0, tabs.findIndex((t) => t.value === active.value))
      const activePanel = tabs.find((t) => t.value === active.value) ?? tabs[0]

      const highlight = h('span', {
        'aria-hidden': 'true',
        style: {
          position: 'absolute',
          top: '4px',
          bottom: '4px',
          left: '4px',
          width: `calc((100% - 8px) / ${n})`,
          transform: `translateX(${index * 100}%)`,
          transition: 'transform 0.25s ease',
          background: 'var(--color-bg, #ffffff)',
          borderRadius: 'calc(var(--radius, 8px) - 2px)',
        },
      })

      const triggers = tabs.map((t) => {
        const on = t.value === active.value
        return h(
          'button',
          {
            key: t.value,
            type: 'button',
            role: 'tab',
            'aria-selected': on,
            onClick: () => (active.value = t.value),
            style: {
              position: 'relative',
              zIndex: 1,
              flex: 1,
              padding: '0.4rem 0.75rem',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: on ? 600 : 400,
              color: on ? 'var(--color-text, #0f172a)' : 'var(--color-muted, #64748b)',
            },
          },
          t.label,
        )
      })

      const tablist = h(
        'div',
        {
          role: 'tablist',
          style: {
            position: 'relative',
            display: 'flex',
            padding: '4px',
            background: 'var(--color-surface, #f1f5f9)',
            borderRadius: 'var(--radius, 8px)',
          },
        },
        [highlight, ...triggers],
      )

      // overflow-hidden container transitions its measured height; the inner div keys on `active`
      // so the fade-in keyframe replays on switch.
      const panel = h(
        'div',
        { style: { marginTop: '1rem', overflow: 'hidden', transition: 'height 0.25s ease', height: height.value != null ? `${height.value}px` : 'auto' } },
        [
          h(
            'div',
            { ref: contentEl, key: active.value, role: 'tabpanel', style: { animation: 'vike-blocks-tab-in 0.25s ease' } },
            activePanel ? h(Blocks, { sections: activePanel.sections }) : null,
          ),
        ],
      )

      const style = h('style', '@keyframes vike-blocks-tab-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}')

      return h('div', { 'data-slot': 'tabs', style: { marginTop: '0.75rem' } }, [style, tablist, panel])
    }
  },
}

registerBlockRenderer('tabs', TabsView)
