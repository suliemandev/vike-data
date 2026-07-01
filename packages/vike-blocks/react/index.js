// The React binding for vike-blocks: the block-renderer registry (registerBlockRenderer),
// the <Blocks>/<Page> dispatch, and the built-in primitive element components. Importing this
// registers the built-in element renderers. vike-view/react registers the schema renderers
// (list/record/form) into the same shared registry; a third-party vike-element-* registers its
// own with registerBlockRenderer.
export { registerBlockRenderer, getBlockRenderer, blockRendererTokens } from './registry.js'
export { Blocks, Page } from './Blocks.jsx' // importing Blocks registers the built-in elements
export { Text, Heading, Badge, Divider, Link, Markdown, Stat } from './elements.jsx'
