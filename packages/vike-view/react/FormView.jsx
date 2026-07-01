// The React renderer for a `form` block — create/edit inputs derived from the schema. It wraps
// the shared FormFields (which dispatches each control through the field-widget registry, so an
// enum column renders a <select>, a `.as('file')` column renders vike-storage's uploader, etc.)
// in a ready-to-post <form> with a submit. `values` pre-fills on edit; `action` is where it
// posts (the data layer wires the write in the MVP proof); with none it's an inert structural
// render. A page that wants its own <form> chrome can use FormFields directly instead.
import { FormFields } from './FormFields.jsx'

export function FormView({ table, fields = [], values, action, submitLabel = 'Save' }) {
  return (
    <form method="post" action={action} data-table={table} style={{ display: 'grid', gap: '0.9rem' }}>
      <FormFields fields={fields} values={values} />
      <div>
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  )
}
