// The Vue renderer for a `list` block — the Vue twin of vike-view/react/ListView.jsx. Standalone
// it draws columns + rows; it also carries the options a full admin list needs (fkLabels,
// sort/dir/sortHref for sortable header links, rowHref for a per-row action), all optional, so
// vike-admin/vue can render its list THROUGH this one component.
import { h } from 'vue'

const cell = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '14px' }
const th = { ...cell, color: 'var(--color-muted)', fontWeight: 600 }

function relativeTime(value) {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return String(value)
  const secs = Math.round((Date.now() - then) / 1000)
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [name, size] of units) {
    const n = Math.floor(secs / size)
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

function formatValue(value, format) {
  if (value == null) return ''
  if (format === 'since') return relativeTime(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

export const ListView = (props) => {
  const columns = props.columns ?? []
  const rows = props.rows ?? []
  const pk = props.pk ?? 'id'
  const emptyLabel = props.emptyLabel ?? 'No rows.'
  const hasActions = typeof props.rowHref === 'function'

  function header(c) {
    if (!c.sortable || typeof props.sortHref !== 'function') return c.label
    const active = props.sort === c.name
    const nextDir = active && props.dir === 'asc' ? 'desc' : 'asc'
    const arrow = active ? (props.dir === 'asc' ? ' ↑' : ' ↓') : ''
    return h('a', { href: props.sortHref(c.name, nextDir), style: { color: 'inherit', textDecoration: 'none' } }, `${c.label}${arrow}`)
  }

  const headRow = columns.map((c) => h('th', { key: c.name, style: th }, header(c)))
  if (hasActions) headRow.push(h('th', { style: { ...th, width: '1px' } }))

  const body =
    rows.length === 0
      ? [h('tr', [h('td', { style: { ...cell, color: 'var(--color-muted)' }, colspan: columns.length + (hasActions ? 1 : 0) || 1 }, emptyLabel)])]
      : rows.map((row, i) => {
          const tds = columns.map((c) =>
            h('td', { key: c.name, style: cell }, props.fkLabels?.[c.name]?.[row[c.name]] ?? formatValue(row[c.name], c.format)),
          )
          if (hasActions) {
            tds.push(
              h('td', { style: { ...cell, textAlign: 'right', whiteSpace: 'nowrap' } }, h('a', { href: props.rowHref(row), style: { color: 'var(--color-primary)', fontSize: '14px' } }, props.rowActionLabel ?? 'Edit')),
            )
          }
          return h('tr', { key: row[pk] ?? i }, tds)
        })

  return h('table', { style: { width: '100%', borderCollapse: 'collapse' }, 'data-table': props.table }, [
    h('thead', [h('tr', headRow)]),
    h('tbody', body),
  ])
}
ListView.props = ['table', 'columns', 'rows', 'pk', 'fkLabels', 'sort', 'dir', 'sortHref', 'rowHref', 'rowActionLabel', 'emptyLabel']
