// The React binding for vike-elements: the block-renderer registry (registerElementRenderer),
// the <Blocks>/<Page> dispatch, and the built-in primitive element components. Importing this
// registers the built-in element renderers. vike-view/react registers the schema renderers
// (list/record/form) into the same shared registry; a third-party vike-element-* registers its
// own with registerElementRenderer.
export { registerElementRenderer, getElementRenderer, elementRendererTokens } from './registry.js'
export { Blocks, Page } from './Blocks.jsx' // importing Blocks registers the built-in elements
export { Text, Heading, Badge, Divider, Link, Markdown, Stat } from './elements.jsx'
