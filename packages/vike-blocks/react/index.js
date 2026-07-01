// The React binding for vike-blocks: the block-renderer registry (registerBlockRenderer),
// the <Blocks>/<Page> dispatch, and the built-in primitive block components. Importing this
// registers the built-in block renderers. vike-view/react registers the schema renderers
// (list/record/form) into the same shared registry; a third-party vike-block-* registers its
// own with registerBlockRenderer.
import './ButtonView.jsx' // side-effect: register the button renderer
import './TabsView.jsx' // side-effect: register the tabs renderer
import './AccordionView.jsx' // side-effect: register the accordion renderer
export { registerBlockRenderer, getBlockRenderer, blockRendererTokens } from './registry.js'
export { Blocks, Page } from './Blocks.jsx' // importing Blocks registers the built-in blocks
export { Text, Heading, Badge, Divider, Link, Markdown, Stat } from './primitives.jsx'
export { ButtonView } from './ButtonView.jsx'
export { TabsView } from './TabsView.jsx'
export { AccordionView } from './AccordionView.jsx'
