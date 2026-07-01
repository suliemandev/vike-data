// The React binding for vike-view: the schema block renderers (list / record / form). Importing
// this registers them into the shared block-renderer registry (vike-elements' 'blocks'/'react'
// slot), so vike-elements' <Blocks>/<Page> draws a `{ block: 'list', table }` section with
// ListView, etc. It also re-exports vike-elements/react's dispatch surface, so a schema app gets
// everything it needs to render from one import.
import './widgets.jsx' // register the built-in field widgets into the shared 'react' slot
import { registerElementRenderer } from 'vike-elements/react'
import { ListView } from './ListView.jsx'
import { RecordView } from './RecordView.jsx'
import { FormView } from './FormView.jsx'

registerElementRenderer('list', ListView)
registerElementRenderer('record', RecordView)
registerElementRenderer('form', FormView)

export { ListView, RecordView, FormView }
export { FormFields } from './FormFields.jsx'
// The field-widget seam: register a control for a `.as()` semantic token (shared with vike-admin).
export { registerFieldWidget, getFieldWidget, fieldWidgetTokens } from './widget-registry.js'
// Re-export the dispatch surface (which also registers the primitive element renderers).
export { Blocks, Page, registerElementRenderer, getElementRenderer, elementRendererTokens } from 'vike-elements/react'
