// Neutral, DECLARATIVE schema IR + a tiny builder DSL.
//
// An extension calls defineSchema('users', t => { ... }) ONCE. The result is
// plain data (no ORM imported) describing the desired table state. Each adapter
// compiler turns that same IR into its own artifact. "Declarative" is the key
// choice: Prisma/Drizzle diff desired-state to produce a migration, and the
// native engine generates one from it, so the shared format stays state, not
// imperative migration steps.

/**
 * @typedef {Object} Column
 * @property {string}  name
 * @property {'uuid'|'string'|'text'|'integer'|'boolean'|'timestamp'} type
 * @property {boolean} nullable
 * @property {boolean} unique
 * @property {boolean} primary
 * @property {*}       default   // undefined = none; 'now' = current timestamp
 */

export function defineSchema(table, build) {
  /** @type {Column[]} */
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
  return { table, columns }
}
