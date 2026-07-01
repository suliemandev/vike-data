// The `accordion` block — a CONTAINER block like tabs: each item holds a nested composition of
// blocks, revealed by expand/collapse. Which items are open is local UI state in the renderer (not
// a data action), so it needs no serialized closure. Harvested from Animate UI's accordion UX and
// reimplemented dep-free: the same measured height-morph + fade the tabs renderers use, styled on
// the `var(--color-*)` contract so a theme restyles it for free.
//
//   accordion()
//     .item('shipping', 'Shipping', [text('Ships in 2-3 days.')])
//     .item('returns',  'Returns',  [text('30-day returns.')])
//     .defaultValue('shipping')          // single-open by default
//
//   accordion().multiple().item(...).item(...).defaultValue(['a', 'b'])  // multi-open
//
// An item's sections are ordinary blocks (built-ins or custom), so accordions compose recursively.
import { registerBlock } from './registry.js'
import { resolvePage } from './page.js'

// Collapse a section that is a builder to its plain descriptor (definePage does this for top-level
// sections; an item's sections need the same so `resolve` gets `{ block, ...props }` objects).
const collapse = (sections) => (sections ?? []).map((s) => (typeof s?.build === 'function' ? s.build() : s))

// Normalize the declared initial-open value(s) to an array of item values (a single-open accordion
// takes a string, a multi-open one takes an array; either form is accepted for both).
const toOpenList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value])

// A fluent builder for an accordion block. `.item()` appends a section (its blocks are collapsed now
// so a nested accordion collapses recursively); `.multiple()` allows several open at once (default
// is single-open); `.defaultValue()` sets which item(s) start open.
export function accordion() {
  const items = []
  let mode = 'single'
  let defaultValue
  const self = {
    item(value, label, sections = []) {
      items.push({ value, label, sections: collapse(sections) })
      return self
    },
    multiple() {
      mode = 'multiple'
      return self
    },
    single() {
      mode = 'single'
      return self
    },
    defaultValue(value) {
      defaultValue = value
      return self
    },
    build() {
      return { block: 'accordion', items: items.map((i) => ({ ...i })), mode, ...(defaultValue !== undefined ? { defaultValue } : {}) }
    },
  }
  return self
}

// Resolve each item's sections into serializable view-models (the recursive step that makes the
// accordion a container), and compute the INITIAL open set. In single-open mode only the first
// declared default opens; a multi-open accordion keeps them all. The renderer draws the item
// headers + panels and owns the live open/closed state; `openValues` is only the starting point.
registerBlock('accordion', {
  resolve({ props, tables }) {
    const items = (props.items ?? []).map((it) => ({
      value: it.value,
      label: it.label ?? it.value,
      sections: resolvePage({ sections: collapse(it.sections) }, tables).sections,
    }))
    const multiple = props.mode === 'multiple'
    const open = toOpenList(props.defaultValue)
    return { items, multiple, openValues: multiple ? open : open.slice(0, 1) }
  },
})
