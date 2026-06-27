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
// contract wants the row(s) back, so update reads the matched rows first and returns them with
// the patch applied, and upsert re-reads by the conflict key.
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
    // Rudder's `upsert([row], uniqueBy, updateCols)` returns a COUNT, so re-read the row by the
    // conflict key to honour the "return the row" contract. updateCols = every non-conflict
    // column, so a replayed event converges the row.
    async upsert(table, row, { onConflict } = {}) {
      if (!onConflict || !onConflict.length) return fromRow(await q(table).create(row))
      const updateCols = Object.keys(row).filter((c) => !onConflict.includes(c))
      await q(table).upsert([row], onConflict, updateCols)
      const key = Object.fromEntries(onConflict.map((c) => [c, row[c]]))
      return fromRow(await applyWhere(q(table), key).first())
    },

    // UPDATE -> the updated rows. Rudder's bulk `updateAll` returns only an affected-row COUNT
    // (no RETURNING on a bulk write), so to honour the "return the rows" contract we read the
    // matched rows FIRST, then return them with the patch applied. This is the same post-state
    // the in-memory reference adapter returns (it assigns the patch onto each matched row), and
    // unlike a re-read it needs NO primary key — so it is correct for any PK shape, including a
    // non-`id` or composite primary key. (The previous version re-read by a hard-coded `id` and
    // returned [] whenever the PK was not literally `id`, even though the write succeeded — #142.)
    // A patch that mutates a filtered column is handled too: the captured row holds the
    // pre-update values and the patch overrides exactly the columns it changes.
    async update(table, filter, patch) {
      const matched = await applyWhere(q(table), filter).get()
      if (!matched.length) return []
      // Empty patch => memory-parity no-op: the in-memory reference adapter does
      // `Object.assign(r, {})` and returns the matched rows unchanged, but Rudder's
      // `updateAll({})` throws ("compileUpdate called with no columns to set"). Return
      // the matched rows unchanged instead of issuing a (failing) UPDATE.
      if (Object.keys(patch ?? {}).length === 0) return fromRows(matched)
      await applyWhere(q(table), filter).updateAll(patch)
      return matched.map((row) => fromRow({ ...row, ...patch }))
    },

    // DELETE -> number of rows deleted (`deleteAll` returns the affected-row count).
    async delete(table, filter) {
      return applyWhere(q(table), filter).deleteAll()
    },
  }
}
