// Merge every contributed schema fragment into final tables, then derive the
// migrations from the result. This is what a binding (e.g. vike-schema) does with
// the contributions it collects through its cumulative config point.

export function mergeSchemas(fragments) {
  const tables = new Map()
  const conflicts = []

  // creates first: each establishes a table + its base columns
  for (const f of fragments.filter((f) => f.mode === 'create')) {
    if (tables.has(f.table)) {
      conflicts.push({ kind: 'duplicate-table', table: f.table })
      continue
    }
    tables.set(f.table, { table: f.table, columns: f.columns.map((c) => ({ ...c })) })
  }

  // extends next: a 3rd-party extension ADDS columns to an existing table
  for (const f of fragments.filter((f) => f.mode === 'extend')) {
    const t = tables.get(f.table)
    if (!t) {
      conflicts.push({ kind: 'extend-missing-table', table: f.table })
      continue
    }
    for (const c of f.columns) {
      const existing = t.columns.find((x) => x.name === c.name)
      if (existing) {
        // EDIT of someone else's column: detected, NOT silently applied.
        conflicts.push({ kind: 'column-edit', table: f.table, column: c.name })
        continue
      }
      t.columns.push({ ...c, added: true }) // `added` = contributed by an extend
    }
  }

  return { tables: [...tables.values()], conflicts }
}

// Migrations are DERIVED from the schema, in contribution order. (Ordering is
// contribution/specificity order, not dependency-aware: that reconciliation is a
// known deferred hard part.)
//
// Duplicate `create`s are skipped: when several extensions each self-install a
// shared extension (e.g. both auth and billing extend vike-schema), Vike includes
// that extension's cumulative contributions once per occurrence, so its tables
// arrive more than once. We dedupe by table name here.
export function deriveMigrations(fragments) {
  const pad = (x) => String(x).padStart(3, '0')
  const seenCreate = new Set()
  const out = []
  for (const f of fragments) {
    if (f.mode === 'create') {
      if (seenCreate.has(f.table)) continue
      seenCreate.add(f.table)
      out.push(`${pad(out.length + 1)}_create_${f.table}_table`)
    } else {
      const cols = f.columns.map((c) => c.name).join('_')
      out.push(`${pad(out.length + 1)}_alter_${f.table}_add_${cols}`)
    }
  }
  return out
}
