// /admin/:table/:id — the detail/edit page. The same fields as the create form, pre-filled
// with the row's current values, POSTing back to its own route. The data hook
// (vike-admin/data:editData) owns the POST: a default submit UPDATES, the Delete control
// (a separate form posting `_action=delete`) DELETEs, both redirecting to the list. No
// client JS, no fetch; plain form posts, SSR all the way.
import { useData } from 'vike-react/useData'

const label = { display: 'block', color: 'var(--color-muted)', fontSize: 13, marginBottom: 4 }
const input = {
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

export default function EditPage() {
  const { table, label: title, fields, values, id } = useData()
  const action = `/admin/${table}/${encodeURIComponent(id)}`
  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Edit {singular(title)}</h1>
        <a href={`/admin/${table}`} style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          &larr; {title}
        </a>
      </div>

      <form
        method="post"
        action={action}
        style={{
          marginTop: 'var(--space-md, 1rem)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius, 10px)',
          padding: 'var(--space-lg, 1.5rem)',
          display: 'grid',
          gap: 'var(--space-md, 1rem)',
        }}
      >
        {fields.map((f) =>
          f.type === 'boolean' ? (
            <label key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" name={f.name} defaultChecked={!!values[f.name]} />
              {f.label}
            </label>
          ) : (
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
                style={input}
              />
            </div>
          ),
        )}
        <div>
          <button
            type="submit"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-text, #fff)',
              border: 'none',
              padding: '0.55rem 1.1rem',
              borderRadius: 'var(--radius, 8px)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </form>

      {/* Delete is its own form so the row submit stays a clean UPDATE; the data hook keys
          on the `_action` field. */}
      <form method="post" action={action} style={{ marginTop: 'var(--space-md, 1rem)' }}>
        <input type="hidden" name="_action" value="delete" />
        <button
          type="submit"
          style={{
            background: 'transparent',
            color: 'var(--color-danger, #c0392b)',
            border: '1px solid var(--color-danger, #c0392b)',
            padding: '0.45rem 0.9rem',
            borderRadius: 'var(--radius, 8px)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </form>
    </div>
  )
}

// "Users" -> "User" for the heading; harmless if a label isn't a plain plural.
function singular(label) {
  return /s$/i.test(label) ? label.replace(/s$/i, '') : label
}
