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
// Returning the row(s): the universal-orm contract wants the written row(s) back. Rudder's bulk
// writes expose `updateAllReturning` / `upsertReturning` (>=1.6.0), which run the write with
// `RETURNING *` and hand back the ACTUAL stored rows — DB-applied defaults, coercion, and
// trigger/generated-column effects all reflected, for any primary-key shape. This is why the
// peer is `>=1.6.0`.
import { normalizeOrderBy, isInCondition } from '@universal-orm/core'

// universal-orm's orderBy direction is lower-case; Rudder's query builder wants 'ASC'/'DESC'.
const DIR = { asc: 'ASC', desc: 'DESC' }

/**
 * Build a universal-orm adapter over a Rudder NativeAdapter.
 *
 * @param native     a `@rudderjs/database` NativeAdapter (`native.query(table)` returns a
 *                   fresh query builder per call).
 */
export function createRudderAdapter(native) {
  if (!native || typeof native.query !== 'function') {
    throw new Error('@universal-orm/rudder: createRudderAdapter(native) expects a @rudderjs/database NativeAdapter (with .query(table))')
  }

  // A FRESH builder per op — `.where()` is chainable/mutating, so reusing one would leak
  // conditions across calls.
  const q = (table) => native.query(table)

  // Normalise a row READ back from the DB to universal-orm's value contract. universal-orm
  // speaks UTC ISO strings for timestamps (its isoNow(), the same the memory adapter stores),
  // but the Postgres driver (porsager) parses a `timestamp`/`timestamptz` column to a JS `Date`
  // on read, while SQLite returns the verbatim ISO string. Left as-is, the same neutral call
  // would return a `Date` on pg and a string on sqlite/memory, breaking equality filters and
  // string comparisons on the pg path. Coerce any `Date` back to an ISO string so reads are
  // uniform across drivers. A no-op on sqlite (no Date values) and for non-timestamp columns.
  const fromRow = (row) => {
    if (!row || typeof row !== 'object') return row
    let out = row
    for (const k in row) {
      if (row[k] instanceof Date) {
        if (out === row) out = { ...row }
        out[k] = row[k].toISOString()
      }
    }
    return out
  }
  const fromRows = (rows) => rows.map(fromRow)

  // Apply a neutral filter (equality + `in`, the narrow surface) onto a builder. An empty
  // filter adds no WHERE, so it matches every row. Returns the builder for chaining.
  const applyWhere = (b, filter) => {
    for (const [col, cond] of Object.entries(filter ?? {})) {
      if (isInCondition(cond)) b.where(col, 'IN', cond.in)
      else b.where(col, cond)
    }
    return b
  }

  return {
    // INSERT -> the inserted row. `.create()` returns the stored row via RETURNING * (sqlite /
    // pg), so DB-generated columns (id, defaults) come back. Snake_case keys, no mapping.
    async insert(table, row) {
      return fromRow(await q(table).create(row))
    },

    // FIND -> matching rows. Builds where -> orderBy -> limit -> offset, so a call with none of
    // them is the plain "select all" path. orderBy columns were validated upstream.
    async find(table, filter, opts = {}) {
      const b = applyWhere(q(table), filter)
      for (const { column, dir } of normalizeOrderBy(opts.orderBy)) b.orderBy(column, DIR[dir] ?? 'ASC')
      if (opts.limit != null) b.limit(Number(opts.limit))
      if (opts.offset) b.offset(Number(opts.offset))
      return fromRows(await b.get())
    },

    // COUNT -> number of matching rows (Rudder counts in the DB; no rows fetched).
    async count(table, filter) {
      return applyWhere(q(table), filter).count()
    },

    // UPSERT -> the upserted row. With no conflict target it is a plain insert. With one,
    // `upsertReturning([row], uniqueBy, updateCols)` (Rudder >=1.6.0) runs ON CONFLICT DO
    // UPDATE ... RETURNING * and returns the ACTUAL stored row — including a column the DB
    // default filled (e.g. an omitted conflict key), which the old re-read-by-input-key path
    // missed: it re-selected by `{ key: undefined }` and returned null (#320). updateCols =
    // every non-conflict column, so a replayed event converges the row.
    async upsert(table, row, { onConflict } = {}) {
      if (!onConflict || !onConflict.length) return fromRow(await q(table).create(row))
      const updateCols = Object.keys(row).filter((c) => !onConflict.includes(c))
      const [r] = await q(table).upsertReturning([row], onConflict, updateCols)
      if (r) return fromRow(r)
      // Empty updateCols => ON CONFLICT DO NOTHING, which RETURNs no row on a conflict (the
      // insert was a no-op). Read the existing row by the conflict key to honour the contract.
      const key = Object.fromEntries(onConflict.map((c) => [c, row[c]]))
      return fromRow(await applyWhere(q(table), key).first())
    },

    // UPDATE -> the updated rows. `updateAllReturning(patch)` (Rudder >=1.6.0) runs
    // UPDATE ... RETURNING *, so the returned rows are the REAL post-write state — DB-side
    // coercion, defaults, and trigger/generated-column effects all reflected — for ANY primary
    // key shape (incl. non-`id` / composite), with no re-read. This replaces the previous
    // read-then-JS-merge, which echoed the patch over a pre-write snapshot and so hid any value
    // the DB computed differently from the input (#319). Empty filter matches every row;
    // RETURNING gives [] when nothing matches.
    async update(table, filter, patch) {
      // Empty patch => memory-parity no-op: the in-memory reference adapter does
      // `Object.assign(r, {})` and returns the matched rows unchanged, but a bulk UPDATE with
      // no SET columns throws. Return the matched rows (a read) instead of issuing one.
      if (Object.keys(patch ?? {}).length === 0) {
        return fromRows(await applyWhere(q(table), filter).get())
      }
      return fromRows(await applyWhere(q(table), filter).updateAllReturning(patch))
    },

    // DELETE -> number of rows deleted (`deleteAll` returns the affected-row count).
    async delete(table, filter) {
      return applyWhere(q(table), filter).deleteAll()
    },
  }
}
