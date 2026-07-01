// The React renderer for a `record` block — the read-only detail of one row. Draws the derived
// fields as a label/value list; `row` (the record's values) is optional here (the data layer
// supplies it later), so with none it shows the field structure. A field carrying `fk` shows the
// referenced row's label from `row[`${name}_label`]` when the data layer provides it, else the
// raw key. Props are the block's resolved model ({ table, fields }) plus optional `row`.
const rowStyle = { display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }
const labelStyle = { color: 'var(--color-muted)', minWidth: 160 }

function display(field, row) {
  if (!row) return ''
  const raw = row[field.name]
  if (raw == null) return ''
  if (field.widget === 'boolean') return raw ? 'Yes' : 'No'
  if (field.fk) return String(row[`${field.name}_label`] ?? raw) // fk label if the data layer set it
  return String(raw)
}

export function RecordView({ table, fields = [], row }) {
  return (
    <dl style={{ margin: 0 }} data-table={table}>
      {fields.map((f) => (
        <div key={f.name} style={rowStyle}>
          <dt style={labelStyle}>{f.label}</dt>
          <dd style={{ margin: 0, color: 'var(--color-text)' }}>{display(f, row)}</dd>
        </div>
      ))}
    </dl>
  )
}
