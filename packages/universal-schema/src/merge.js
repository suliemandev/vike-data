// Normalize the cumulative `schemas` contributions into a flat fragment list.
// Each source contributes EITHER a static array of fragments OR a function of the
// resolved config (a COMPUTED contribution: the schema an extension declares can
// depend on a config the app set, e.g. billing keyed per-user vs per-org). Vike
// delivers a computed contribution as a live function (defined via a pointer-import
// / +file, since inline functions can't be serialized into a runtime config);
// here we just call it with the resolved config.
export function resolveSchemas(contributions, config) {
  const fragments = (contributions || []).flatMap((entry) =>
    typeof entry === 'function' ? entry(config) || [] : entry || [],
  )
  return dedupeFragments(fragments)
}

// Drop structurally-IDENTICAL fragments. When several extensions each
// self-install a shared extension, a Vike without idempotent installation
// (pre-#3355) includes that extension's cumulative `schemas` once per occurrence,
// so the exact same fragment arrives multiple times (vike-schema's `_migrations`,
// vike-auth's `users`, etc.). Deduping by structural identity here collapses those
// to one — the generalized form of the `_migrations` dedupe — so every consumer
// (runtime render AND the build-time generator) sees a clean list. A genuine
// conflict (the same table defined DIFFERENTLY) has a different key, survives, and
// is still flagged by mergeSchemas. Defense-in-depth + back-compat; on a Vike with
// #3355 there are no duplicates and this is a no-op.
export function dedupeFragments(fragments) {
  const seen = new Set()
  const out = []
  for (const f of fragments) {
    const key = `${f.mode}:${f.table}:${JSON.stringify(f.columns)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

// Order fragments so a table is created AFTER the tables its foreign keys point
// at. Vike's cumulative config hands contributions back in config-specificity
// order, which is NOT dependency-aware — so e.g. billing's `subscriptions`
// (FK -> organizations) can arrive before teams' `organizations`. That is
// harmless for the declarative ORMs (Prisma/Drizzle desired-state), but a broken
// order for native migrations (a create referencing a not-yet-created table).
//
// This is a stable topological sort: creates come out in dependency order
// (FK target before dependant), alters come after their own table's create, and
// ties keep original order. Self-references and FKs whose target isn't a create
// in this set are ignored (a users<->organizations cycle stays acyclic here
// because the back-reference, current_organization_id, is contributed as an
// alter, not part of either create). Any genuine residual cycle falls back to
// original order rather than dropping fragments.
export function orderFragments(fragments) {
  const creates = fragments.filter((f) => f.mode === 'create')
  const createTables = new Set(creates.map((f) => f.table))
  const deps = (f) =>
    new Set(
      f.columns
        .filter((c) => c.references && c.references.table !== f.table && createTables.has(c.references.table))
        .map((c) => c.references.table),
    )

  const emitted = new Set()
  const out = []
  const emittedTable = (t) => out.some((f) => f.mode === 'create' && f.table === t)

  let progress = true
  while (out.length < fragments.length && progress) {
    progress = false
    for (const f of fragments) {
      if (emitted.has(f)) continue
      // A create waits for the tables its FKs point at; an alter additionally
      // waits for its own table's create (it can only add a column once the
      // table exists).
      const depsReady = [...deps(f)].every((t) => emittedTable(t))
      const ready = f.mode === 'create' ? depsReady : depsReady && emittedTable(f.table)
      if (ready) {
        out.push(f)
        emitted.add(f)
        progress = true
      }
    }
  }
  // Residual cycle (shouldn't happen here): append the rest in original order.
  for (const f of fragments) if (!emitted.has(f)) out.push(f)
  return out
}

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

  // references last: every foreign key must point at a table + column that
  // actually exist in the MERGED schema. This is the cross-extension referential
  // integrity check — e.g. vike-teams referencing vike-auth's `users.id` only
  // validates once auth is installed; a dangling ref is a conflict, not a crash.
  for (const t of tables.values()) {
    for (const c of t.columns) {
      if (!c.references) continue
      const target = tables.get(c.references.table)
      if (!target) {
        conflicts.push({ kind: 'unknown-reference-table', table: t.table, column: c.name, target: c.references.table })
      } else if (!target.columns.some((x) => x.name === c.references.column)) {
        conflicts.push({ kind: 'unknown-reference-column', table: t.table, column: c.name, target: `${c.references.table}.${c.references.column}` })
      }
    }
  }

  return { tables: [...tables.values()], conflicts }
}

// Derive the relation graph from the merged tables. A foreign key is a single
// declaration on the owning column, but ORMs that model navigation (Prisma's
// relation fields, Drizzle's relations()) need BOTH ends. So for each table we
// compute the relations it OWNS (forward, one entry per FK column) and the ones
// pointing AT it (inverse, contributed by other tables' FKs).
//
// Naming is mechanical and collision-free: the relation NAME is `<table>_<fk>`
// (globally unique), so Prisma can disambiguate multiple/circular relations
// between the same two models without hand-authored @relation names. The forward
// FIELD name strips a trailing `_id` (`user_id` -> `user`); the inverse field
// reuses the unique relation name. FKs are treated one-to-many unless the FK
// column is unique (then one-to-one).
export function deriveRelations(tables) {
  const byTable = new Map(tables.map((t) => [t.table, { forward: [], inverse: [] }]))
  for (const t of tables) {
    for (const c of t.columns) {
      if (!c.references) continue
      const name = `${t.table}_${c.name}`
      const fieldName = c.name.endsWith('_id') ? c.name.slice(0, -3) : `${c.name}_ref`
      const rel = {
        name,
        owner: t.table,
        fkColumn: c.name,
        target: c.references.table,
        refColumn: c.references.column,
        nullable: c.nullable,
        toOne: !!c.unique, // unique FK => one-to-one; otherwise one-to-many
        onDelete: c.onDelete,
        fieldName, // forward field name on the owner
      }
      byTable.get(t.table)?.forward.push(rel)
      byTable.get(c.references.table)?.inverse.push(rel)
    }
  }
  return byTable
}

// Migrations are DERIVED from the schema, in contribution order. (Ordering is
// contribution/specificity order, not dependency-aware: that reconciliation is a
// known deferred hard part.)
//
// Duplicate `create`s are skipped: when several extensions each self-install a
// shared extension (e.g. both auth and billing extend vike-schema), older Vike
// included that extension's cumulative contributions once per occurrence, so its
// tables arrived more than once. We dedupe by table name here.
//
// Vike fixed this upstream (extension installation is now idempotent, vikejs/vike
// #3355, merged 2026-06-20). This dedupe stays as defense-in-depth and back-compat
// for users on a Vike version without the fix.
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
