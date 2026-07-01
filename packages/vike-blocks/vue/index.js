// The Vue binding for vike-blocks: the block-renderer registry (registerBlockRenderer), the
// <Blocks>/<Page> dispatch, and the built-in primitive block components. Importing this
// registers the built-in block renderers. vike-view/vue registers the schema renderers
// (list/record/form) into the same shared 'blocks'/'vue' registry.
import './ButtonView.js' // side-effect: register the button renderer
import './AlertView.js' // side-effect: register the alert renderer
import './TabsView.js' // side-effect: register the tabs renderer
import './AccordionView.js' // side-effect: register the accordion renderer
import './DialogView.js' // side-effect: register the dialog renderer
export { registerBlockRenderer, getBlockRenderer, blockRendererTokens } from './registry.js'
export { Blocks, Page } from './Blocks.js' // importing Blocks registers the built-in blocks
export { Text, Heading, Badge, Divider, Link, Markdown, Stat } from './primitives.js'
export { ButtonView } from './ButtonView.js'
export { AlertView } from './AlertView.js'
export { TabsView } from './TabsView.js'
export { AccordionView } from './AccordionView.js'
export { DialogView } from './DialogView.js'
