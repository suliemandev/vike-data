// The form inputs shared by the create and edit pages. One control per resolved field,
// dispatched through the field-widget registry on the field's `widget` token (derived in
// resolve.js from the column's `.as()` semantic, #176): a checkbox for booleans, a <select>
// for foreign keys + enums, a textarea for long text / json, a typed input otherwise, and
// whatever an extension registered (e.g. vike-storage's `file`). An unknown token falls back
// to the plain text input, so a column always renders. `values` pre-fills on edit.
//
// Importing ./widgets registers the built-in widgets as a side effect; FormFields itself stays
// a one-line dispatcher so adding a field kind never touches this file.
import './widgets.jsx'
import { getFieldWidget } from './widget-registry.js'

export function FormFields({ fields, values = {} }) {
  return fields.map((f) => {
    const Widget = getFieldWidget(f.fk ? 'select' : (f.widget ?? f.type)) ?? getFieldWidget('text')
    return <Widget key={f.name} field={f} value={values[f.name]} />
  })
}
