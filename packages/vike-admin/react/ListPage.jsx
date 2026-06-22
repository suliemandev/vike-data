// /admin/:table — the list. A table of the resource's rows over the resolved columns,
// with a link to the create form. universal-orm `find` returns every row (no pagination
// yet, flagged in the epic), so this renders the full set. Pure presentation; the data
// hook (vike-admin/data:listData) read the rows through universal-orm.
import { useData } from 'vike-react/useData'

const cell = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: 14 }
const th = { ...cell, color: 'var(--color-muted)', fontWeight: 600 }

// Client-applied formatters (the `format` token a column may carry). Unknown tokens fall
// back to the raw value.
function formatValue(value, format) {
  if (value == null) return ''
  if (format === 'since') return relativeTime(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

function relativeTime(value) {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return String(value)
  const secs = Math.round((Date.now() - then) / 1000)
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [name, size] of units) {
    const n = Math.floor(secs / size)
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

export default function ListPage() {
  const { table, label, columns, rows, canCreate } = useData()
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{label}</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a href="/admin" style={{ color: 'var(--color-muted)', fontSize: 14 }}>
            &larr; Admin
          </a>
          {canCreate && (
            <a
              href={`/admin/${table}/new`}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-primary-text, #fff)',
                padding: '0.4rem 0.9rem',
                borderRadius: 'var(--radius, 8px)',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              New
            </a>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 'var(--space-md, 1rem)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius, 10px)',
          overflow: 'hidden',
          background: 'var(--color-surface)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.name} style={th}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td style={{ ...cell, color: 'var(--color-muted)' }} colSpan={columns.length || 1}>
                  No rows yet.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns.map((c) => (
                    <td key={c.name} style={cell}>
                      {formatValue(row[c.name], c.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
