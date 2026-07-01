// The Vue binding for vike-view: the schema block renderers (list / record / form). Importing
// this registers them into the shared block-renderer registry (vike-blocks' 'blocks'/'vue'
// slot), so vike-blocks/vue's <Blocks>/<Page> draws a `{ block: 'list', table }` section with
// ListView, etc. It also re-exports vike-blocks/vue's dispatch surface, so a schema app gets
// everything it needs to render from one import.
import './widgets.js' // register the built-in Vue field widgets into the shared 'vue' slot
import { registerBlockRenderer } from 'vike-blocks/vue'
import { ListView } from './ListView.js'
import { RecordView } from './RecordView.js'
import { FormView } from './FormView.js'

registerBlockRenderer('list', ListView)
registerBlockRenderer('record', RecordView)
registerBlockRenderer('form', FormView)

export { ListView, RecordView, FormView }
export { FormFields } from './FormFields.js'
export { registerFieldWidget, getFieldWidget, fieldWidgetTokens } from './widget-registry.js'
export { Blocks, Page, registerBlockRenderer, getBlockRenderer, blockRendererTokens } from 'vike-blocks/vue'
