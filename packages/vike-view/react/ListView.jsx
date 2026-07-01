// The React renderer for a `list` block. Draws the derived columns as a table header; `rows`
// are optional here (the data layer supplies them later, in the MVP-proof wiring), so with no
// rows it shows the column structure and an empty state. No React import (vike-react automatic
// JSX runtime). Props are the block's resolved model ({ table, columns }) plus optional `rows`.
const cell = { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', fontSize: 14 }
const th = { ...cell, color: 'var(--color-muted)', fontWeight: 600 }

// A named client-side formatter token -> a display transform. Unknown tokens render the raw value.
function formatValue(value, format) {
  if (value == null) return ''
  if (format === 'since' && (typeof value === 'string' || value instanceof Date)) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString()
  }
  return String(value)
}

export function ListView({ table, columns = [], rows = [] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} data-table={table}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.name} style={th}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td style={{ ...cell, color: 'var(--color-muted)' }} colSpan={columns.length || 1}>
              No rows.
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.name} style={cell}>{formatValue(row[c.name], c.format)}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
