// The Rudder adapter (#46/#75): runs the neutral universal-orm operations against a
// `@rudderjs/database` NativeAdapter — Rudder's Laravel-style query builder. The app builds
// the connection and hands it here (via `vike-rudder`); extensions keep calling
// `db.<table>.<op>` and never import an ORM. Same shape as `@universal-orm/drizzle`:
//
//   import { NativeAdapter } from '@rudderjs/database/native'
//   const native = await NativeAdapter.make({ driver: 'pg', url: process.env.DATABASE_URL })
//   const adapter = createRudderAdapter(native)
//
// Why this is simpler than the Drizzle adapter: Rudder's raw query builder speaks DB column
// names (snake_case) DIRECTLY — a row comes back as `{ password_hash: ... }`, not a Model's
// camelCase. universal-orm also speaks snake_case (the schema's names), so neutral keys pass
// straight through with NO name<->property translation and the adapter needs only the
// connection, not the generated schema tables (column validation already happened upstream in
// `createRepository`).
//
// The one wrinkle: Rudder's BULK writes (`updateAll` / `upsert`) return an affected-row COUNT,
// not the rows (only single-row `.create()` / `.update(id, ...)` return via RETURNING). The
// contract wants the row(s) back, so for update/upsert we do a follow-up read.
import { normalizeOrderBy } from '@universal-orm/core'

// universal-orm's orderBy direction is lower-case; Rudder's query builder wants 'ASC'/'DESC'.
const DIR = { asc: 'ASC', desc: 'DESC' }

/**
 * Build a universal-orm adapter over a Rudder NativeAdapter.
 *
 * @param native     a `@rudderjs/database` NativeAdapter (`native.query(table)` returns a
 *                   fresh query builder per call).
 * @param options    `{ primaryKey }` — the single-column PK used to re-read updated rows
 *                   (default `'id'`; composite PKs are a follow-up, see #75).
 */
export function createRudderAdapter(native, { primaryKey = 'id' } = {}) {
  if (!native || typeof native.query !== 'function') {
    throw new Error('@universal-orm/rudder: createRudderAdapter(native) expects a @rudderjs/database NativeAdapter (with .query(table))')
  }

  // A FRESH builder per op — `.where()` is chainable/mutating, so reusing one would leak
  // conditions across calls.
  const q = (table) => native.query(table)

  // Apply a neutral filter (equality + `in`, the narrow surface) onto a builder. An empty
  // filter adds no WHERE, so it matches every row. Returns the builder for chaining.
  const applyWhere = (b, filter) => {
    for (const [col, cond] of Object.entries(filter ?? {})) {
      if (cond !== null && typeof cond === 'object' && Array.isArray(cond.in)) b.where(col, 'IN', cond.in)
      else b.where(col, cond)
    }
    return b
  }

  return {
    // INSERT -> the inserted row. `.create()` returns the stored row via RETURNING * (sqlite /
    // pg), so DB-generated columns (id, defaults) come back. Snake_case keys, no mapping.
    async insert(table, row) {
      return q(table).create(row)
    },

    // FIND -> matching rows. Builds where -> orderBy -> limit -> offset, so a call with none of
    // them is the plain "select all" path. orderBy columns were validated upstream.
    async find(table, filter, opts = {}) {
      const b = applyWhere(q(table), filter)
      for (const { column, dir } of normalizeOrderBy(opts.orderBy)) b.orderBy(column, DIR[dir] ?? 'ASC')
      if (opts.limit != null) b.limit(Number(opts.limit))
      if (opts.offset) b.offset(Number(opts.offset))
      return b.get()
    },

    // COUNT -> number of matching rows (Rudder counts in the DB; no rows fetched).
    async count(table, filter) {
      return applyWhere(q(table), filter).count()
    },

    // UPSERT -> the upserted row. With no conflict target it is a plain insert. With one,
    // Rudder's `upsert([row], uniqueBy, updateCols)` returns a COUNT, so re-read the row by the
    // conflict key to honour the "return the row" contract. updateCols = every non-conflict
    // column, so a replayed event converges the row.
    async upsert(table, row, { onConflict } = {}) {
      if (!onConflict || !onConflict.length) return q(table).create(row)
      const updateCols = Object.keys(row).filter((c) => !onConflict.includes(c))
      await q(table).upsert([row], onConflict, updateCols)
      const key = Object.fromEntries(onConflict.map((c) => [c, row[c]]))
      return applyWhere(q(table), key).first()
    },

    // UPDATE -> the updated rows. `updateAll` returns a count, so capture the matched primary
    // keys FIRST, then re-read by them after the update — that way a patch which mutates a
    // filtered column still returns the rows that were changed (the post-update filter wouldn't
    // match them). Single-column PK assumed (see options.primaryKey).
    async update(table, filter, patch) {
      const matched = await applyWhere(q(table), filter).get()
      const ids = matched.map((r) => r[primaryKey])
      if (!ids.length) return []
      await applyWhere(q(table), filter).updateAll(patch)
      return q(table).where(primaryKey, 'IN', ids).get()
    },

    // DELETE -> number of rows deleted (`deleteAll` returns the affected-row count).
    async delete(table, filter) {
      return applyWhere(q(table), filter).deleteAll()
    },
  }
}
