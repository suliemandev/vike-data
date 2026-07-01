// The Vue renderer for a `record` block — the read-only detail of one row (the Vue twin of
// vike-view/react/RecordView.jsx). Draws the derived fields as a label/value list; `row` is
// optional (the data layer supplies it later). A field carrying `fk` shows the referenced row's
// label from `row[`${name}_label`]` when the data layer provides it, else the raw key.
import { h } from 'vue'

const rowStyle = { display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '14px' }
const labelStyle = { color: 'var(--color-muted)', minWidth: '160px' }

function display(field, row) {
  if (!row) return ''
  const raw = row[field.name]
  if (raw == null) return ''
  if (field.widget === 'boolean') return raw ? 'Yes' : 'No'
  if (field.fk) return String(row[`${field.name}_label`] ?? raw)
  return String(raw)
}

export const RecordView = (props) =>
  h('dl', { style: { margin: 0 }, 'data-table': props.table }, (props.fields ?? []).map((f) =>
    h('div', { key: f.name, style: rowStyle }, [
      h('dt', { style: labelStyle }, f.label),
      h('dd', { style: { margin: 0, color: 'var(--color-text)' } }, display(f, props.row)),
    ]),
  ))
RecordView.props = ['table', 'fields', 'row']
