// The Vue form-field dispatcher — one control per resolved field, dispatched through the Vue
// field-widget registry (the Vue twin of vike-view/react/FormFields.jsx). Importing ./widgets
// registers the built-ins. `values` pre-fills on edit.
import './widgets.js'
import { h } from 'vue'
import { getFieldWidget } from './widget-registry.js'

export const FormFields = (props) =>
  (props.fields ?? []).map((f) => {
    const Widget = getFieldWidget(f.fk ? 'select' : (f.widget ?? f.type)) ?? getFieldWidget('text')
    return h(Widget, { key: f.name, field: f, value: props.values?.[f.name] })
  })
FormFields.props = ['fields', 'values']
