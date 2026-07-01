// The framework-agnostic DATA layer — the server-side complement to resolveView. Where
// resolveView derives a view's STRUCTURE from the schema (columns / fields), this fills in the
// DATA each data-driven block needs before it reaches the client: a `list` block gets its paged,
// owner-scoped rows + FK labels; a `record` block gets its one row. It also owns the write path
// (create / update / delete), so a rendered form actually persists. Runs on the app's ORM
// repository (buildDb), so it works on the memory adapter (demo/tests) or a real database
// unchanged.
//
// ROW SCOPING (#104) is a caller-supplied `scope(table, ctx) -> filter` (the owner contract wires
// it: e.g. `(t) => ({ user_id: ctx.user.id })`). The filter bounds every read AND is forced onto
// writes, so a scoped user only ever sees / edits / creates their own rows. Kept as a function
// the caller passes at request time (not baked into the serialized block), so a scope predicate
// never has to serialize to the client.
import { randomUUID } from 'node:crypto'
import { resolvePage } from 'vike-elements'
import { projectRow } from './project.js'
import { tableNamed, recordTitleColumn } from './resolve.js'

const DEFAULT_PAGE_SIZE = 20

const primaryKeyOf = (schemaTable) => schemaTable?.columns.find((c) => c.primary)?.name ?? 'id'

function scopeFor(scope, table, ctx) {
  if (typeof scope !== 'function') return {}
  return scope(table, ctx) ?? {}
}

// Force a scope's scalar owner columns onto a row/patch, so a scoped user can't create a row
// owned by someone else or reassign ownership (a forged owner field is overwritten).
function forceOwnership(obj, scopeFilter) {
  for (const [col, val] of Object.entries(scopeFilter)) {
    if (val !== null && typeof val !== 'object') obj[col] = val
  }
  return obj
}

// FK labels for a list's columns: { col: { value -> referenced-row title } }, so a FK cell shows
// the title instead of the raw key. Bounded by the target table's own scope.
async function fkLabelsFor(columns, schemaTable, { db, tables, scope, ctx }) {
  const byName = new Map(schemaTable.columns.map((c) => [c.name, c]))
  const labels = {}
  for (const col of columns) {
    const ref = byName.get(col.name)?.references
    if (!ref) continue
    const targetTable = tableNamed(tables, ref.table)
    if (!targetTable) continue
    const titleCol = recordTitleColumn({}, targetTable)
    const rows = await db[ref.table].find(scopeFor(scope, ref.table, ctx))
    labels[col.name] = Object.fromEntries(rows.map((r) => [r[ref.column], String(r[titleCol] ?? r[ref.column])]))
  }
  return labels
}

async function hydrateList(section, { db, tables, scope, ctx, search = {} }) {
  const { table, columns } = section.resolved
  const schemaTable = tableNamed(tables, table)
  const pk = primaryKeyOf(schemaTable)

  const sortable = new Set(columns.filter((c) => c.sortable).map((c) => c.name))
  const sort = sortable.has(search.sort) ? search.sort : null
  const dir = search.dir === 'desc' ? 'desc' : 'asc'
  const orderBy = sort ? [{ column: sort, dir }] : undefined

  const where = scopeFor(scope, table, ctx)
  const total = await db[table].count(where)
  const pageSize = DEFAULT_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, Number(search.page) || 1), pageCount)
  const offset = (page - 1) * pageSize

  const rows = await db[table].find(where, { limit: pageSize, offset, orderBy })
  const fkLabels = await fkLabelsFor(columns, schemaTable, { db, tables, scope, ctx })
  // Project to the visible columns (+pk) so a hidden column never ships to the client (#228).
  const projected = rows.map((r) => projectRow(r, { columns, pk }))

  return { ...section, resolved: { ...section.resolved, rows: projected, fkLabels, pk, page, pageCount, total, sort, dir } }
}

async function hydrateRecord(section, { db, tables, scope, ctx }) {
  const { table, fields } = section.resolved
  const schemaTable = tableNamed(tables, table)
  const pk = primaryKeyOf(schemaTable)
  const id = section.props.id
  if (id == null) return { ...section, resolved: { ...section.resolved, row: null, pk } }
  const owned = { ...scopeFor(scope, table, ctx), [pk]: id }
  const row = await db[table].findOne(owned)
  return { ...section, resolved: { ...section.resolved, row: row ? projectRow(row, { columns: fields, pk }) : null, pk } }
}

// Resolve a view AND fill in the data its blocks need. Returns hydrated sections a renderer
// draws directly (`{ block, props, resolved }`, with `resolved.rows` / `resolved.row` filled).
export async function hydrateView(view, opts = {}) {
  const resolved = resolvePage(view, opts.tables)
  const sections = await Promise.all(
    resolved.sections.map((s) => (s.block === 'list' ? hydrateList(s, opts) : s.block === 'record' ? hydrateRecord(s, opts) : Promise.resolve(s))),
  )
  return { route: resolved.route, sections }
}

// Build a row from submitted form data, coercing each field by its type. An unchecked checkbox
// sends no value (boolean reads false on absence); an empty string becomes null; an integer is
// numeric. `form` is a FormData / URLSearchParams-shaped object (`.get` / `.has`).
export function rowFromForm(fields, form) {
  const row = {}
  for (const f of fields) {
    if (f.type === 'boolean' || f.widget === 'boolean') {
      row[f.name] = form.get(f.name) === 'on' || form.get(f.name) === 'true'
      continue
    }
    if (!form.has(f.name)) continue
    let value = form.get(f.name)
    if (value === '') value = null
    else if (f.type === 'integer' || f.widget === 'integer') value = value == null ? value : Number(value)
    row[f.name] = value
  }
  return row
}

// Insert a row from a submitted form: coerce, fill a client-generatable (uuid/string) primary
// key, FORCE the scope's owner columns, insert. Returns the inserted row.
export async function createRow(db, tables, table, fields, form, { scope, ctx } = {}) {
  const schemaTable = tableNamed(tables, table)
  const row = rowFromForm(fields, form)
  const pk = schemaTable?.columns.find((c) => c.primary)
  if (pk && row[pk.name] == null && (pk.type === 'uuid' || pk.type === 'string')) row[pk.name] = randomUUID()
  forceOwnership(row, scopeFor(scope, table, ctx))
  await db[table].insert(row)
  return row
}

// Update a row by its primary key AND the scope, so a scoped user can only edit a row they own
// (an id-guess for another owner matches nothing). Re-forces ownership so an edit can't reassign
// the row. Returns the updated row, or null when nothing matched.
export async function updateRow(db, tables, table, fields, id, form, { scope, ctx } = {}) {
  const schemaTable = tableNamed(tables, table)
  const pk = primaryKeyOf(schemaTable)
  const sc = scopeFor(scope, table, ctx)
  const owned = { ...sc, [pk]: id }
  const patch = forceOwnership(rowFromForm(fields, form), sc)
  await db[table].update(owned, patch)
  return db[table].findOne(owned)
}

// Delete a row by its primary key AND the scope. Returns the number of rows deleted (0 when the
// row isn't the user's).
export function deleteRow(db, tables, table, id, { scope, ctx } = {}) {
  const schemaTable = tableNamed(tables, table)
  const pk = primaryKeyOf(schemaTable)
  const owned = { ...scopeFor(scope, table, ctx), [pk]: id }
  return db[table].delete(owned)
}
