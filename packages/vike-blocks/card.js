// The `card` block — a static CONTAINER block: a bordered, padded surface with an optional
// header (title + description) and footer, wrapping a nested composition of blocks. The most-used
// building block; unlike tabs/accordion it holds no live UI state (nothing to expand or switch),
// so the renderer is a plain themed box. Styled on the `var(--color-*)` / `--radius` contract so a
// theme restyles it for free; dep-free and cross-framework.
//
//   card([heading('Team members').level(3), text('Manage who has access.')])
//     .title('Settings')
//     .description('Update your workspace preferences.')
//     .footer([button('Save').variant('primary')])
//
// The body (and footer) sections are ordinary blocks, so cards compose recursively.
import { registerBlock } from './registry.js'
import { resolvePage } from './page.js'

// Collapse a section that is a builder to its plain descriptor (definePage does this for top-level
// sections; a card's nested sections need the same so `resolve` gets `{ block, ...props }` objects).
const collapse = (sections) => (sections ?? []).map((s) => (typeof s?.build === 'function' ? s.build() : s))

// A fluent builder for a card block. The body sections are passed to `card(...)` (or `.body(...)`);
// `.title()` / `.description()` set the header, `.footer()` the footer. Nested builders collapse
// now so a nested card collapses recursively.
export function card(sections = []) {
  let body = collapse(sections)
  let footer
  let title
  let description
  const self = {
    body(next = []) {
      body = collapse(next)
      return self
    },
    title(value) {
      title = value
      return self
    },
    description(value) {
      description = value
      return self
    },
    footer(next = []) {
      footer = collapse(next)
      return self
    },
    build() {
      return {
        block: 'card',
        sections: body.map((s) => ({ ...s })),
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(footer !== undefined ? { footer: footer.map((s) => ({ ...s })) } : {}),
      }
    },
  }
  return self
}

// Resolve the body (and footer) sections into serializable view-models — the recursive step that
// makes the card a container. The header text passes through; the renderer draws the box, header,
// body, and footer.
registerBlock('card', {
  resolve({ props, tables }) {
    return {
      title: props.title ?? null,
      description: props.description ?? null,
      sections: resolvePage({ sections: collapse(props.sections) }, tables).sections,
      footer: props.footer ? resolvePage({ sections: collapse(props.footer) }, tables).sections : null,
    }
  },
})
