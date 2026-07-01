// The Vue renderer for the `accordion` block — the Vue twin of react/AccordionView.jsx. A stateful
// component (a `setup` with refs), theme-native (vike-themes CSS vars), with the same pure-CSS
// height morph (each panel measured, then transitioned 0 <-> px) and fade the tabs renderer uses.
// Single-open mode closes the others on open; both modes are collapsible. Each item's resolved
// sections are drawn with <Blocks>. Zero animation dependency.
import { h, ref, reactive, nextTick, onMounted } from 'vue'
import { Blocks } from './Blocks.js'
import { registerBlockRenderer } from './registry.js'

const chevron = (open) =>
  h(
    'svg',
    {
      'aria-hidden': 'true',
      width: '16',
      height: '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      style: { flexShrink: 0, transition: 'transform 0.25s ease', transform: open ? 'rotate(180deg)' : 'none' },
    },
    [h('polyline', { points: '6 9 12 15 18 9' })],
  )

export const AccordionView = {
  props: ['items', 'multiple', 'openValues'],
  setup(props) {
    const openSet = ref(new Set(props.openValues ?? []))
    const heights = reactive({}) // item value -> px (or 0 when collapsed)
    const contentEls = {} // item value -> inner content el, for measuring

    // Measure each open item's natural content height (the inner el keeps its size while the wrapper
    // collapses), so the wrapper can transition 0 <-> px; collapsed items measure to 0.
    const measure = () => {
      for (const it of props.items ?? []) {
        const el = contentEls[it.value]
        if (el) heights[it.value] = openSet.value.has(it.value) ? el.offsetHeight : 0
      }
    }
    onMounted(() => nextTick(measure))

    const toggle = (value) => {
      const next = new Set(openSet.value)
      if (next.has(value)) next.delete(value)
      else {
        if (!props.multiple) next.clear() // single-open: opening one closes the rest
        next.add(value)
      }
      openSet.value = next
      nextTick(measure)
    }

    return () => {
      const items = props.items ?? []
      const rows = items.map((item) => {
        const open = openSet.value.has(item.value)

        const header = h(
          'button',
          {
            type: 'button',
            'aria-expanded': open,
            onClick: () => toggle(item.value),
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: '0.75rem',
              padding: '0.85rem 0.25rem',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 600,
              textAlign: 'left',
              color: 'var(--color-text, #0f172a)',
            },
          },
          [h('span', item.label), chevron(open)],
        )

        const panel = h(
          'div',
          { style: { overflow: 'hidden', transition: 'height 0.28s ease', height: heights[item.value] != null ? `${heights[item.value]}px` : 'auto' } },
          [
            h(
              'div',
              {
                ref: (el) => (contentEls[item.value] = el),
                role: 'region',
                style: { opacity: open ? 1 : 0, transition: 'opacity 0.28s ease', paddingBottom: '0.85rem' },
              },
              h(Blocks, { sections: item.sections }),
            ),
          ],
        )

        return h('div', { key: item.value, 'data-slot': 'accordion-item', style: { borderBottom: '1px solid var(--color-border, #e2e8f0)' } }, [header, panel])
      })

      return h('div', { 'data-slot': 'accordion', style: { marginTop: '0.75rem', borderTop: '1px solid var(--color-border, #e2e8f0)' } }, rows)
    }
  },
}

registerBlockRenderer('accordion', AccordionView)
