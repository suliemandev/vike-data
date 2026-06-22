// The form inputs shared by the create and edit pages. One input per resolved field,
// derived from its type: a checkbox for booleans, a <select> for foreign keys (options
// filled by the data hook from the referenced table), a typed text input otherwise.
// `values` pre-fills on edit; absent on create.
const label = { display: 'block', color: 'var(--color-muted)', fontSize: 13, marginBottom: 4 }
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

const htmlType = (type) => (type === 'integer' ? 'number' : type === 'email' ? 'email' : 'text')

export function FormFields({ fields, values = {} }) {
  return fields.map((f) => {
    if (f.type === 'boolean') {
      return (
        <label key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" name={f.name} defaultChecked={!!values[f.name]} />
          {f.label}
        </label>
      )
    }

    if (f.fk || f.type === 'select') {
      const options = f.options ?? []
      return (
        <div key={f.name}>
          <label style={label} htmlFor={f.name}>
            {f.label}
            {f.required ? ' *' : ''}
          </label>
          <select id={f.name} name={f.name} required={f.required} defaultValue={values[f.name] ?? ''} style={control}>
            {/* A nullable FK gets an empty choice; a required one forces a pick. */}
            {!f.required && <option value="">—</option>}
            {options.map((o) => (
              <option key={String(o.value)} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )
    }

    return (
      <div key={f.name}>
        <label style={label} htmlFor={f.name}>
          {f.label}
          {f.required ? ' *' : ''}
        </label>
        <input
          id={f.name}
          name={f.name}
          type={htmlType(f.type)}
          required={f.required}
          defaultValue={values[f.name] ?? ''}
          style={control}
        />
      </div>
    )
  })
}
