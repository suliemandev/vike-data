// /admin/:table — the list. The TABLE (columns, sortable headers, FK cells, per-row edit link,
// empty state) is rendered by vike-view's ListView — vike-admin is a preset over vike-view, so
// it draws its list through the same component instead of a second table. This page keeps the
// admin CHROME around it: the title, the "New" button, and prev/next paging. The data hook
// (vike-admin/data:listData) reads just the page through universal-orm and hands over the
// page/sort state; navigation is plain query-string links (`?page=&sort=&dir=`), so it works
// without client JS.
import { useData } from 'vike-react/useData'
import { ListView } from 'vike-view/react'

// Build an /admin/:table URL carrying the paging/sort state; empty params are dropped so a
// default view stays a clean `/admin/:table`.
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

export default function ListPage() {
  const { table, label, columns, rows, fkLabels, pk, canEdit, page, pageCount, total, sort, dir } = useData()

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
        <ListView
          table={table}
          columns={columns}
          rows={rows}
          pk={pk}
          fkLabels={fkLabels}
          sort={sort}
          dir={dir}
          sortHref={(name, nextDir) => listUrl(table, { page: 1, sort: name, dir: nextDir })}
          rowHref={canEdit ? (row) => `/admin/${table}/${row[pk]}` : undefined}
          emptyLabel="No rows yet."
        />
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
