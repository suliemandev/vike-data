// The `dialog` block — an overlay modal that holds a nested composition of blocks. The catalog's
// most interactive built-in: a trigger button opens it; open/close is local UI state in the renderer
// (not a data action, so no serialized closure). A confirm button that MUTATES data is the actions
// axis (#385), out of scope here. Harvested from Animate UI's Base dialog and reimplemented dep-free:
// the renderers do the portal + backdrop + focus-trap + escape/outside-click + scroll-lock
// themselves, with a CSS enter/exit, styled on the `var(--color-*)` / `--radius` contract.
//
//   dialog()
//     .title('Delete post')
//     .description('This cannot be undone.')
//     .trigger('Delete')
//     .sections([text('Are you sure you want to delete this post?')])
//     .footer([button('Cancel').variant('ghost'), button('Delete').variant('danger')])
//
// The body/footer sections are ordinary blocks (built-ins or custom), so dialogs compose recursively.
import { registerBlock } from './registry.js'
import { resolvePage } from './page.js'

// Collapse a section that is a builder to its plain descriptor (definePage does this for top-level
// sections; the body/footer sections need the same so `resolve` gets `{ block, ...props }` objects).
const collapse = (sections) => (sections ?? []).map((s) => (typeof s?.build === 'function' ? s.build() : s))

// A fluent builder for a dialog block. `.title()` / `.description()` head the modal; `.trigger()`
// is the opening button's label; `.sections()` is the body (nested blocks, collapsed now so a nested
// dialog collapses recursively); `.footer()` is an optional action row; `.defaultOpen()` opens it on
// first render.
export function dialog() {
  let title = ''
  let description
  let trigger = 'Open'
  let sections = []
  let footer
  let defaultOpen = false
  const self = {
    title(value) {
      title = value
      return self
    },
    description(value) {
      description = value
      return self
    },
    trigger(label) {
      trigger = label
      return self
    },
    sections(list) {
      sections = collapse(list)
      return self
    },
    footer(list) {
      footer = collapse(list)
      return self
    },
    defaultOpen(value = true) {
      defaultOpen = !!value
      return self
    },
    build() {
      return {
        block: 'dialog',
        title,
        trigger,
        sections: sections.map((s) => ({ ...s })),
        ...(description !== undefined ? { description } : {}),
        ...(footer !== undefined ? { footer: footer.map((s) => ({ ...s })) } : {}),
        ...(defaultOpen ? { defaultOpen: true } : {}),
      }
    },
  }
  return self
}

// Resolve the body (and optional footer) sections into serializable view-models (the recursive step
// that makes the dialog a container), and pass the modal chrome through. The renderer owns the live
// open/closed state; `defaultOpen` is only the INITIAL state.
registerBlock('dialog', {
  resolve({ props, tables }) {
    const sections = resolvePage({ sections: collapse(props.sections) }, tables).sections
    const footer = props.footer ? resolvePage({ sections: collapse(props.footer) }, tables).sections : []
    return {
      title: props.title ?? '',
      description: props.description ?? null,
      trigger: props.trigger ?? 'Open',
      sections,
      footer,
      defaultOpen: props.defaultOpen ?? false,
    }
  },
})
