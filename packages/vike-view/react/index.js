// The React binding for vike-view: the schema block renderers (list / record / form). Importing
// this registers them into the shared block-renderer registry (vike-blocks' 'blocks'/'react'
// slot), so vike-blocks' <Blocks>/<Page> draws a `{ block: 'list', table }` section with
// ListView, etc. It also re-exports vike-blocks/react's dispatch surface, so a schema app gets
// everything it needs to render from one import.
import './widgets.jsx' // register the built-in field widgets into the shared 'react' slot
import { registerBlockRenderer } from 'vike-blocks/react'
import { ListView } from './ListView.jsx'
import { RecordView } from './RecordView.jsx'
import { FormView } from './FormView.jsx'

registerBlockRenderer('list', ListView)
registerBlockRenderer('record', RecordView)
registerBlockRenderer('form', FormView)

export { ListView, RecordView, FormView }
export { FormFields } from './FormFields.jsx'
// The field-widget seam: register a control for a `.as()` semantic token (shared with vike-admin).
export { registerFieldWidget, getFieldWidget, fieldWidgetTokens } from './widget-registry.js'
// Re-export the dispatch surface (which also registers the primitive block renderers).
export { Blocks, Page, registerBlockRenderer, getBlockRenderer, blockRendererTokens } from 'vike-blocks/react'
// Page generation: turn `defineView`s into Vike pages (spread into `+config.js` `pages`).
export { viewPages, viewForRoute } from './pages.js'
