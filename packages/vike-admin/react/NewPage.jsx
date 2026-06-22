// /admin/:table/new — the create form. An input per resolved field (FormFields derives
// the control from each field's type, including FK selects). It POSTs to its OWN route;
// the data hook (vike-admin/data:newData) owns the POST: it inserts through universal-orm
// and redirects back to the list. No client JS, no fetch — a plain form post, SSR all the
// way.
import { useData } from 'vike-react/useData'
import { FormFields } from './FormFields.jsx'

export default function NewPage() {
  const { table, label: title, fields } = useData()
  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>New {singular(title)}</h1>
        <a href={`/admin/${table}`} style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          &larr; {title}
        </a>
      </div>

      <form
        method="post"
        action={`/admin/${table}/new`}
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
        <FormFields fields={fields} />
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
            Create
          </button>
        </div>
      </form>
    </div>
  )
}

// "Users" -> "User" for the heading; harmless if a label isn't a plain plural.
function singular(label) {
  return /s$/i.test(label) ? label.replace(/s$/i, '') : label
}
