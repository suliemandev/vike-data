// The built-in BESPOKE blocks — pass-throughs whose view-model is just their props (the
// renderer draws them). The schema-derived blocks (list/record/form) are NOT here: they live
// in vike-view, which registers them into this same registry. The fluent leaf elements
// (text/heading/badge/divider/link) are registered by ./elements.js through defineElement.
import { registerBlock } from './registry.js'

registerBlock('stat', {}) // { title, source|value }
registerBlock('markdown', {}) // { source }
registerBlock('custom', {}) // { component } — the renderer imports the component
