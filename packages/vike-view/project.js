// Row projection — the single allow-list that decides which columns of a row leave the
// server. A view hides columns by convention (a primary `id`, any `*_hash`, the
// `created_at`/`updated_at` timestamps — see resolve.js `isHiddenColumn`) and a view can
// narrow further with `list`/`record`/`form`. The raw DB row, however, carries every
// column, including the hidden ones (a `password_hash`, an unlisted secret).
//
// Every surface must narrow the row to the visible set before it leaves the process:
// a JSON API projects its response rows, and the HTML data hooks project the rows/values
// they hand to the page, which the renderer serializes verbatim into the client hydration
// payload. Keeping the projection here, shared, means the HTML and JSON paths can't drift
// on what a row exposes (#228).

// Narrow a row to the columns the view exposes (its list/record/form columns) plus the
// primary key, dropping every other column. `columns` is the visible-column/field list
// (each `{ name }`); `pk` is kept even though it's a hidden column, because the list/edit
// UI keys its links on it.
export function projectRow(row, { columns = [], pk } = {}) {
  if (!row) return row
  const keys = new Set([pk, ...columns.map((c) => c.name)].filter(Boolean))
  const out = {}
  for (const k of keys) if (k in row) out[k] = row[k]
  return out
}
