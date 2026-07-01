// The React renderer for a `form` block — create/edit inputs derived from the schema. Draws one
// control per field, choosing the control from the field's `widget`/`type` (the same tokens
// vike-admin's field-widget registry keys on; unifying on that shared registry is a follow-up).
// `values` optionally pre-fills on edit. The <form> posts to `action` when given (the data layer
// wires the write in the MVP proof); with none it's an inert structural render. No React import.
const labelStyle = { display: 'block', color: 'var(--color-muted)', fontSize: 13, marginBottom: 4 }
const control = {
  width: '100%',
  padding: '0.5rem 0.6rem',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 8px)',
  background: 'var(--color-bg, #fff)',
  color: 'var(--color-text)',
  fontSize: 14,
  boxSizing: 'border-box',
}
const HTML_INPUT = { email: 'email', date: 'date', integer: 'number', text: 'text' }

function Control({ field, value }) {
  const common = { id: field.name, name: field.name, required: field.required }
  if (field.widget === 'boolean' || field.type === 'boolean') {
    return <input {...common} type="checkbox" defaultChecked={!!value} />
  }
  if (field.type === 'select' || field.options) {
    return (
      <select {...common} defaultValue={value ?? ''} style={control}>
        {!field.required ? <option value="" /> : null}
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }
  if (field.widget === 'longtext') {
    return <textarea {...common} defaultValue={value ?? ''} rows={4} style={control} />
  }
  return <input {...common} type={HTML_INPUT[field.widget] ?? 'text'} defaultValue={value ?? ''} style={control} />
}

export function FormView({ table, fields = [], values, action, submitLabel = 'Save' }) {
  return (
    <form method="post" action={action} data-table={table} style={{ display: 'grid', gap: '0.9rem' }}>
      {fields.map((f) => (
        <div key={f.name}>
          <label style={labelStyle} htmlFor={f.name}>
            {f.label}
            {f.required ? ' *' : ''}
          </label>
          <Control field={f} value={values?.[f.name]} />
        </div>
      ))}
      <div>
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  )
}
