// /admin/:table — the list. A table of one PAGE of the resource's rows over the resolved
// columns, with a link to the create form, sortable column headers, and prev/next paging.
// The data hook (vike-admin/data:listData) reads just the page through universal-orm
// (find limit/offset/orderBy + count) and hands over the page/sort state; navigation is
// plain query-string links (`?page=&sort=&dir=`), so it works without client JS.
import { useData } from 'vike-react/useData'

const cell = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: 14 }
const th = { ...cell, color: 'var(--color-muted)', fontWeight: 600 }

// Build an /admin/:table URL carrying the paging/sort state; empty params are dropped
// so a default view stays a clean `/admin/:table`.
function listUrl(table, { page, sort, dir }) {
  const qs = new URLSearchParams()
  if (page && page > 1) qs.set('page', String(page))
  if (sort) {
    qs.set('sort', sort)
    if (dir === 'desc') qs.set('dir', 'desc')
  }
  const s = qs.toString()
  return s ? `/admin/${table}?${s}` : `/admin/${table}`
}

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
  const { table, label, columns, rows, fkLabels, pk, canEdit, page, pageCount, total, sort, dir } = useData()

  // A sortable header links to the same list sorted by its column. Clicking the active
  // column flips the direction; any new column starts ascending. Sorting resets to page 1.
  function headerContent(c) {
    if (!c.sortable) return c.label
    const active = sort === c.name
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc'
    const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
    return (
      <a href={listUrl(table, { page: 1, sort: c.name, dir: nextDir })} style={{ color: 'inherit', textDecoration: 'none' }}>
        {c.label}
        {arrow}
      </a>
    )
  }

  // A prev/next control: a real link, or a muted, non-interactive span at the ends.
  function pageControl(targetPage, content, disabled) {
    const style = {
      padding: '0.35rem 0.75rem',
      borderRadius: 'var(--radius, 8px)',
      border: '1px solid var(--color-border)',
      fontSize: 14,
      textDecoration: 'none',
      color: disabled ? 'var(--color-muted)' : 'var(--color-text)',
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
    }
    return disabled ? (
      <span style={style} aria-disabled="true">
        {content}
      </span>
    ) : (
      <a style={style} href={listUrl(table, { page: targetPage, sort, dir })}>
        {content}
      </a>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{label}</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a href="/admin" style={{ color: 'var(--color-muted)', fontSize: 14 }}>
            &larr; Admin
          </a>
          {canEdit && (
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
                  {headerContent(c)}
                </th>
              ))}
              {canEdit && <th style={{ ...th, width: 1 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td style={{ ...cell, color: 'var(--color-muted)' }} colSpan={columns.length + (canEdit ? 1 : 0) || 1}>
                  No rows yet.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row[pk] ?? i}>
                  {columns.map((c) => (
                    <td key={c.name} style={cell}>
                      {/* a FK cell shows the referenced row's title (from fkLabels), else the raw value */}
                      {fkLabels?.[c.name]?.[row[c.name]] ?? formatValue(row[c.name], c.format)}
                    </td>
                  ))}
                  {canEdit && (
                    <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <a href={`/admin/${table}/${row[pk]}`} style={{ color: 'var(--color-primary)', fontSize: 14 }}>
                        Edit
                      </a>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--space-md, 1rem)',
          fontSize: 14,
          color: 'var(--color-muted)',
        }}
      >
        <span>{total === 0 ? 'No rows' : `Page ${page} of ${pageCount} · ${total} ${total === 1 ? 'row' : 'rows'}`}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {pageControl(page - 1, '← Prev', page <= 1)}
          {pageControl(page + 1, 'Next →', page >= pageCount)}
        </div>
      </div>
    </div>
  )
}
