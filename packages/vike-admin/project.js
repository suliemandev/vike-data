// Row projection — the single allow-list that decides which columns of a row leave the
// server. The admin hides columns by convention (a primary `id`, any `*_hash`, the
// `created_at`/`updated_at` timestamps — see resolve.js `isHiddenColumn`) and a resource
// can narrow further with `list`/`form`. The raw DB row, however, carries every column,
// including the hidden ones (a `password_hash`, an unlisted secret).
//
// Both surfaces must narrow the row to the visible set before it leaves the process:
//   - the JSON agent API (api.js) projects its response rows, and
//   - the HTML data hooks (data.js) project the rows/values they hand to the page, which
//     vike-react serializes verbatim into the client hydration payload.
// Keeping the projection here, shared, means the HTML and JSON paths can't drift on what a
// row exposes — the bug they did drift into (#228), where the JSON path projected and the
// HTML path shipped the whole row.

// Narrow a row to the columns the resource exposes (its list/form columns) plus the primary
// key, dropping every other column. `columns` is the visible-column/field list (each `{ name }`);
// `pk` is kept even though it's a hidden column, because the list/edit UI keys its links on it.
export function projectRow(row, { columns = [], pk } = {}) {
  if (!row) return row
  const keys = new Set([pk, ...columns.map((c) => c.name)].filter(Boolean))
  const out = {}
  for (const k of keys) if (k in row) out[k] = row[k]
  return out
}
