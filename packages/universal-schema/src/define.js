// Neutral, DECLARATIVE schema IR + a tiny builder DSL.
//
// An extension describes its tables ONCE; the result is plain data (no ORM
// imported) that flows through Vike's cumulative config as a contribution.
//
//   defineSchema('users', t => ...)   -> create a new table
//   extendSchema('users', t => ...)   -> add columns to an existing table
//                                        (possibly one ANOTHER extension created)
//
// Migrations are NOT authored here; they are derived from this schema (see
// merge.js). Schema is the source of truth.

function buildColumns(build) {
  const columns = []
  const col = (name, type) => {
    const c = { name, type, nullable: false, unique: false, primary: false, default: undefined }
    columns.push(c)
    const api = {
      primary() { c.primary = true; return api },
      unique() { c.unique = true; return api },
      nullable() { c.nullable = true; return api },
      default(v) { c.default = v; return api },
    }
    return api
  }
  const t = {
    uuid: (n) => col(n, 'uuid'),
    string: (n) => col(n, 'string'),
    text: (n) => col(n, 'text'),
    integer: (n) => col(n, 'integer'),
    boolean: (n) => col(n, 'boolean'),
    timestamp: (n) => col(n, 'timestamp'),
    // sugar: created_at + updated_at, both defaulting to now
    timestamps() {
      col('created_at', 'timestamp').default('now')
      col('updated_at', 'timestamp').default('now')
    },
  }
  build(t)
  return columns
}

export function defineSchema(table, build) {
  return { table, mode: 'create', columns: buildColumns(build) }
}

export function extendSchema(table, build) {
  return { table, mode: 'extend', columns: buildColumns(build) }
}
