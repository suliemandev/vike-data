// vike-blocks — composable UI as data. The framework-agnostic substrate: the block
// registry + defineBlock seam, the definePage composer, and the built-in blocks.
// Importing this root registers the built-in blocks (stat/markdown/custom) and blocks
// (text/heading/badge/divider/link). vike-view layers schema-driven blocks on top; a
// per-framework package registers the renderers.
import './blocks.js' // side-effect: register stat / markdown / custom
import './primitives.js' // side-effect: register text / heading / badge / divider / link

export { definePage, resolvePage } from './page.js'
export { registerBlock, getBlock, hasBlock, listBlocks, defineBlock } from './registry.js'
export { text, heading, badge, divider, link } from './primitives.js'
