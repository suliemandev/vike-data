// The Vue binding for vike-elements: the block-renderer registry (registerElementRenderer), the
// <Blocks>/<Page> dispatch, and the built-in primitive element components. Importing this
// registers the built-in element renderers. vike-view/vue registers the schema renderers
// (list/record/form) into the same shared 'blocks'/'vue' registry.
export { registerElementRenderer, getElementRenderer, elementRendererTokens } from './registry.js'
export { Blocks, Page } from './Blocks.js' // importing Blocks registers the built-in elements
export { Text, Heading, Badge, Divider, Link, Markdown, Stat } from './elements.js'
