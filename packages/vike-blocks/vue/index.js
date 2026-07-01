// The Vue binding for vike-blocks: the block-renderer registry (registerBlockRenderer), the
// <Blocks>/<Page> dispatch, and the built-in primitive block components. Importing this
// registers the built-in block renderers. vike-view/vue registers the schema renderers
// (list/record/form) into the same shared 'blocks'/'vue' registry.
export { registerBlockRenderer, getBlockRenderer, blockRendererTokens } from './registry.js'
export { Blocks, Page } from './Blocks.js' // importing Blocks registers the built-in blocks
export { Text, Heading, Badge, Divider, Link, Markdown, Stat } from './primitives.js'
