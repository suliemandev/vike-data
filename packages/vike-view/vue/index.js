// The Vue binding for vike-view: the schema block renderers (list / record / form). Importing
// this registers them into the shared block-renderer registry (vike-elements' 'blocks'/'vue'
// slot), so vike-elements/vue's <Blocks>/<Page> draws a `{ block: 'list', table }` section with
// ListView, etc. It also re-exports vike-elements/vue's dispatch surface, so a schema app gets
// everything it needs to render from one import.
import './widgets.js' // register the built-in Vue field widgets into the shared 'vue' slot
import { registerElementRenderer } from 'vike-elements/vue'
import { ListView } from './ListView.js'
import { RecordView } from './RecordView.js'
import { FormView } from './FormView.js'

registerElementRenderer('list', ListView)
registerElementRenderer('record', RecordView)
registerElementRenderer('form', FormView)

export { ListView, RecordView, FormView }
export { FormFields } from './FormFields.js'
export { registerFieldWidget, getFieldWidget, fieldWidgetTokens } from './widget-registry.js'
export { Blocks, Page, registerElementRenderer, getElementRenderer, elementRendererTokens } from 'vike-elements/vue'
