// Parsing + validating the `?query=` an agent (or a hand-typed URL) sends to a list.
//
// This is the guardrail that makes the agent API (#113) safe to expose: a caller's
// query is parsed into the NARROW universal-orm surface (#86) and validated against the
// resource's own columns before it ever reaches the database. Unknown columns or
// operators are rejected with a clear error, so `?query=` can never smuggle arbitrary
// SQL or read a column the resource doesn't expose. The caller can only ever NARROW the
// result set; the row scope (resolve.js / data.js) is AND-merged ON TOP so it can't be
// widened past what the UI would show.
//
// The accepted shape (URL-encoded JSON in `?query=`), all parts optional:
//
//   { "filter":  { col: value } | { col: { in: [...] } },   // equality / membership
//     "orderBy": "col" | { column, dir },                    // dir: 'asc' | 'desc'
//     "limit":   <non-negative int, capped>,
//     "offset":  <non-negative int> }
//
// Equality + `in` are the only operators (the #44/#86 filter contract). Anything richer
// (ranges, OR, LIKE, joins) is deliberately unsupported — drop to the ORM, same as the
// rest of universal-orm. No `?query=` at all = an empty query (the plain list).

// A bad query is a 400, not a 500: the caller sent something invalid. The data hook
// turns this into `render(400)`; the api middleware surfaces `.message` as the body.
export class QueryError extends Error {
  constructor(message) {
    super(message)
    this.name = 'QueryError'
    this.isQueryError = true
  }
}

// Hard ceiling on how many rows one request can pull, so an agent can't ask for a
// million rows in a single call. The list UI's own page size stays separate (data.js).
export const MAX_LIMIT = 100

const isScalar = (v) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'

// Validate one filter condition for `col`: a scalar (equality) or `{ in: [scalars] }`.
function validateCondition(col, cond, allowed) {
  if (!allowed.has(col)) throw new QueryError(`unknown filter column: ${JSON.stringify(col)}`)
  if (cond !== null && typeof cond === 'object') {
    const keys = Object.keys(cond)
    if (keys.length !== 1 || keys[0] !== 'in') {
      throw new QueryError(`unsupported operator on ${JSON.stringify(col)} (only equality and \`in\` are allowed)`)
    }
    if (!Array.isArray(cond.in) || !cond.in.every(isScalar)) {
      throw new QueryError(`\`in\` on ${JSON.stringify(col)} must be an array of scalars`)
    }
    return { in: cond.in }
  }
  if (!isScalar(cond)) throw new QueryError(`filter on ${JSON.stringify(col)} must be a scalar or { in: [...] }`)
  return cond
}

// A non-negative integer, or undefined when absent. Rejects negatives / non-integers so a
// bad value is a clear 400 rather than a silently weird page.
function asCount(value, what) {
  if (value == null) return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw new QueryError(`${what} must be a non-negative integer`)
  return n
}

/**
 * Parse + validate a `?query=` value (URL-encoded JSON) against a resource's columns.
 *
 * @param raw       the string from `?query=` (or null/undefined for "no query")
 * @param columns   the resource's viewable columns ([{ name, sortable }]) — defines which
 *                  columns may be filtered on and which may be ordered by.
 * @returns         { filter, orderBy?, limit?, offset? } — normalized, safe to pass to
 *                  universal-orm `find`. An absent part is omitted.
 * @throws QueryError on malformed JSON, unknown column, unsupported operator, or a
 *                  non-sortable orderBy column.
 */
export function parseListQuery(raw, columns = []) {
  if (raw == null || raw === '') return { filter: {} }

  let q
  try {
    q = JSON.parse(raw)
  } catch {
    throw new QueryError('query is not valid JSON')
  }
  if (q === null || typeof q !== 'object' || Array.isArray(q)) {
    throw new QueryError('query must be a JSON object')
  }

  const names = new Set(columns.map((c) => c.name))
  const sortable = new Set(columns.filter((c) => c.sortable).map((c) => c.name))

  const out = { filter: {} }

  if (q.filter != null) {
    if (typeof q.filter !== 'object' || Array.isArray(q.filter)) throw new QueryError('filter must be an object')
    for (const [col, cond] of Object.entries(q.filter)) {
      out.filter[col] = validateCondition(col, cond, names)
    }
  }

  if (q.orderBy != null) {
    const entries = Array.isArray(q.orderBy) ? q.orderBy : [q.orderBy]
    out.orderBy = entries.map((o) => {
      const column = typeof o === 'string' ? o : o?.column
      const dir = typeof o === 'object' && o?.dir != null ? o.dir : 'asc'
      if (!column || typeof column !== 'string') throw new QueryError('orderBy needs a column name')
      // Only a column the resource marked sortable can order the result — the same
      // gate the list UI applies to a hand-typed `?sort=`.
      if (!sortable.has(column)) throw new QueryError(`column ${JSON.stringify(column)} is not sortable`)
      if (dir !== 'asc' && dir !== 'desc') throw new QueryError(`invalid sort direction ${JSON.stringify(dir)} (use 'asc' or 'desc')`)
      return { column, dir }
    })
  }

  const limit = asCount(q.limit, 'limit')
  if (limit != null) out.limit = Math.min(limit, MAX_LIMIT)
  const offset = asCount(q.offset, 'offset')
  if (offset != null) out.offset = offset

  return out
}
