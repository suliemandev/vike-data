// vike-elements — composable UI as data. The framework-agnostic substrate: the block
// registry + defineElement seam, the definePage composer, and the built-in blocks/elements.
// Importing this root registers the built-in blocks (stat/markdown/custom) and elements
// (text/heading/badge/divider/link). vike-view layers schema-driven blocks on top; a
// per-framework package registers the renderers.
import './blocks.js' // side-effect: register stat / markdown / custom
import './elements.js' // side-effect: register text / heading / badge / divider / link

export { definePage, resolvePage } from './page.js'
export { registerBlock, getBlock, hasBlock, listBlocks, defineElement } from './registry.js'
export { text, heading, badge, divider, link } from './elements.js'
