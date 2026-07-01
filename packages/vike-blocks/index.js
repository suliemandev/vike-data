// vike-blocks — composable UI as data. The framework-agnostic substrate: the block
// registry + defineBlock seam, the definePage composer, and the built-in blocks.
// Importing this root registers the bespoke blocks (stat/markdown/custom), the leaf
// primitives (text/heading/badge/divider/link), and the tabs container block. vike-view
// layers schema-driven blocks on top; a per-framework package registers the renderers.
import './blocks.js' // side-effect: register stat / markdown / custom
import './primitives.js' // side-effect: register text / heading / badge / divider / link
import './button.js' // side-effect: register the button block
import './alert.js' // side-effect: register the alert block
import './tabs.js' // side-effect: register the tabs container block
import './accordion.js' // side-effect: register the accordion container block
import './dialog.js' // side-effect: register the dialog container block

export { definePage, resolvePage } from './page.js'
export { registerBlock, getBlock, hasBlock, listBlocks, defineBlock } from './registry.js'
export { text, heading, badge, divider, link } from './primitives.js'
export { button } from './button.js'
export { alert } from './alert.js'
export { tabs } from './tabs.js'
export { accordion } from './accordion.js'
export { dialog } from './dialog.js'
