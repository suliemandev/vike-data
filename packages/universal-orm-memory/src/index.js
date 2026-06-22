// The in-process adapter (#46): executes the neutral universal-orm operations
// against plain in-memory Maps. No database, no ORM — the adapter the tests, the
// demo app and the proof run on. A real deployment swaps in `@universal-orm/drizzle`
// (or a future Prisma/native adapter); the extension code calling `db.<table>.<op>`
// does not change.
//
// It honours the same contract every adapter must (the five operations, each taking
// the table name first) and reuses universal-orm's shared `matchesFilter`, so its
// notion of a filter is identical to every other in-process adapter.

import { matchesFilter } from '@universal-orm/core'

export function createMemoryAdapter() {
  const store = new Map() // table name -> row[]
  const rowsOf = (table) => {
    if (!store.has(table)) store.set(table, [])
    return store.get(table)
  }

  return {
    async insert(table, row) {
      rowsOf(table).push({ ...row })
      return { ...row }
    },

    async find(table, filter) {
      return rowsOf(table)
        .filter((r) => matchesFilter(r, filter))
        .map((r) => ({ ...r }))
    },

    async upsert(table, row, { onConflict } = {}) {
      const rows = rowsOf(table)
      if (onConflict && onConflict.length) {
        const existing = rows.find((r) => onConflict.every((c) => r[c] === row[c]))
        if (existing) {
          Object.assign(existing, row)
          return { ...existing }
        }
      }
      rows.push({ ...row })
      return { ...row }
    },

    async update(table, filter, patch) {
      const updated = []
      for (const r of rowsOf(table)) {
        if (matchesFilter(r, filter)) {
          Object.assign(r, patch)
          updated.push({ ...r })
        }
      }
      return updated
    },

    async delete(table, filter) {
      const rows = rowsOf(table)
      const keep = rows.filter((r) => !matchesFilter(r, filter))
      const removed = rows.length - keep.length
      store.set(table, keep)
      return removed
    },
  }
}
