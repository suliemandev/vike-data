// The form inputs — one control per resolved field, dispatched through the field-widget
// registry on the field's `widget` token (a checkbox for booleans, a <select> for foreign keys
// + enums, a textarea for long text / json, a typed input otherwise, and whatever an extension
// registered, e.g. vike-storage's `file`). An unknown token falls back to the plain text input,
// so a column always renders. `values` pre-fills on edit. This is the fields WITHOUT a form
// wrapper, so a page can place them inside its own <form> chrome (vike-admin does); FormView
// wraps them in a ready-to-post form.
//
// Importing ./widgets registers the built-in widgets as a side effect; this stays a one-line
// dispatcher so adding a field kind never touches this file.
import './widgets.jsx'
import { getFieldWidget } from './widget-registry.js'

export function FormFields({ fields, values = {} }) {
  return fields.map((f) => {
    const Widget = getFieldWidget(f.fk ? 'select' : (f.widget ?? f.type)) ?? getFieldWidget('text')
    return <Widget key={f.name} field={f} value={values[f.name]} />
  })
}
