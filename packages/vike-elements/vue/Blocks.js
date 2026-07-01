// The Vue dispatch: draw a page's blocks by mapping each section's block type to its registered
// Vue component and handing it the section's resolved view-model. The Vue twin of
// vike-elements/react/Blocks.jsx. `Blocks` takes already resolved sections; `Page` resolves a
// view first. A block type with no registered renderer is skipped. Importing this module
// registers the built-in element renderers (via ./elements.js).
import { h } from 'vue'
import { resolvePage } from '../page.js'
import { getElementRenderer } from './registry.js'
import './elements.js' // side-effect: register text / heading / badge / divider / link / markdown / stat

// Draw a list of RESOLVED sections (`{ block, props, resolved }`, from resolvePage/resolveView).
export const Blocks = (props) =>
  (props.sections ?? []).map((section, i) => {
    const Component = getElementRenderer(section.block)
    return Component ? h(Component, { key: i, ...section.resolved }) : null
  })
Blocks.props = ['sections']

// Resolve a view/page against the composed tables, then draw it.
export const Page = (props) => {
  const resolved = resolvePage(props.page, props.tables)
  return h(Blocks, { sections: resolved.sections })
}
Page.props = ['page', 'tables']
