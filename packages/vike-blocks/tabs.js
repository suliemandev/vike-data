// The `tabs` block — a CONTAINER block: each panel is itself a composition of blocks. It is the
// first interactive built-in (which tab is shown is local UI state in the renderer, not a data
// action, so it needs no serialized closure). Harvested from Animate UI's tabs UX, reimplemented
// theme-native (the renderers style on the `var(--color-*)` contract) and cross-framework.
//
//   tabs()
//     .tab('account',  'Account',  [heading('Account').level(3), text('Your profile.')])
//     .tab('password', 'Password', [text('Change your password.')])
//     .defaultValue('account')
//
// A panel's sections are ordinary blocks (built-ins or custom), so tabs compose recursively.
import { registerBlock } from './registry.js'
import { resolvePage } from './page.js'

// Collapse a section that is a builder to its plain descriptor (definePage does this for top-level
// sections; a panel's sections need the same so `resolve` gets `{ block, ...props }` objects).
const collapse = (sections) => (sections ?? []).map((s) => (typeof s?.build === 'function' ? s.build() : s))

// A fluent builder for a tabs block. `.tab()` appends a panel (its sections are collapsed now so a
// nested tabs also collapses recursively); `.defaultValue()` picks the initially-open tab.
export function tabs() {
  const panels = []
  let defaultValue
  const self = {
    tab(value, label, sections = []) {
      panels.push({ value, label, sections: collapse(sections) })
      return self
    },
    defaultValue(value) {
      defaultValue = value
      return self
    },
    build() {
      return { block: 'tabs', tabs: panels.map((p) => ({ ...p })), ...(defaultValue !== undefined ? { defaultValue } : {}) }
    },
  }
  return self
}

// Resolve each panel's sections into serializable view-models (the recursive step that makes tabs a
// container), and pick the active tab (declared `defaultValue`, else the first panel). The renderer
// draws the tab list + the active panel's resolved sections; `activeValue` is only the INITIAL open
// tab (the renderer owns the live state).
registerBlock('tabs', {
  resolve({ props, tables }) {
    const panels = (props.tabs ?? []).map((t) => ({
      value: t.value,
      label: t.label ?? t.value,
      sections: resolvePage({ sections: collapse(t.sections) }, tables).sections,
    }))
    return { tabs: panels, activeValue: props.defaultValue ?? panels[0]?.value ?? null }
  },
})
