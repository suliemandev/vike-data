// The admin's server hooks — Vike `data` hooks (server-env), one per page. They are the
// only place the admin touches the request: each resolves the merged schema + the
// contributed resources from `pageContext.config`, builds a universal-orm repository,
// and returns a PLAIN, serializable view-model the React page renders via useData().
// No ORM is imported; no SQL is written. The create hook also OWNS its POST: the request
// is surfaced to the hook (as a Web Request on server adapters, the raw Node request under
// `vite dev` — normalized by ./request.js), so the same route renders the form (GET) and
// performs the insert (POST). No separate endpoint, and no middleware that can't see the
// composed schema.
import { randomUUID } from 'node:crypto'
import { redirect } from 'vike/abort'
import { readFormRequest } from './request.js'
import { parseListQuery, QueryError } from './query.js'
import {
  resolveAdminTables,
  getResources,
  findResource,
  tableNamed,
  resourceLabel,
  recordTitleColumn,
  canView,
  canEdit,
  buildDb,
  viewColumns,
  viewFields,
} from './resolve.js'

// Fill the `options` of every foreign-key field by reading the referenced table: each
// row becomes `{ value: <ref column>, label: <recordTitle of the target> }`. The target's
// label column comes from its resource's `recordTitle` (else a schema default), so a
// `user_id` field shows users by email instead of by uuid. Plain + serializable.
async function loadFkOptions(fields, { db, config, tables }) {
  return Promise.all(
    fields.map(async (f) => {
      if (!f.fk) return f
      const targetTable = tableNamed(tables, f.fk.table)
      if (!targetTable) return f
      const titleCol = recordTitleColumn(findResource(config, f.fk.table), targetTable)
      const rows = await db[f.fk.table].find({})
      const options = rows.map((r) => ({ value: r[f.fk.column], label: String(r[titleCol] ?? r[f.fk.column]) }))
      return { ...f, options }
    }),
  )
}

// For the list: a per-column map of FK value -> human title, so a FK cell shows the
// referenced row's title instead of the raw key. Only the list's foreign-key columns get
// an entry; everything else renders as-is.
async function fkLabelsFor(columns, schemaTable, { db, config, tables }) {
  const byName = new Map(schemaTable.columns.map((c) => [c.name, c]))
  const labels = {}
  for (const col of columns) {
    const ref = byName.get(col.name)?.references
    if (!ref) continue
    const targetTable = tableNamed(tables, ref.table)
    if (!targetTable) continue
    const titleCol = recordTitleColumn(findResource(config, ref.table), targetTable)
    const rows = await db[ref.table].find({})
    labels[col.name] = Object.fromEntries(rows.map((r) => [r[ref.column], String(r[titleCol] ?? r[ref.column])]))
  }
  return labels
}

// Build a row from submitted form data, coercing each field by its type. An unchecked
// checkbox sends no value, so a boolean field reads as false on absence; an empty string
// becomes null; an integer field is numeric. Shared by create and edit so both coerce
// identically. universal-orm rejects unknown columns, so only declared fields are read.
function rowFromForm(fields, form) {
  const row = {}
  for (const f of fields) {
    if (f.type === 'boolean') {
      row[f.name] = form.get(f.name) === 'on' || form.get(f.name) === 'true'
      continue
    }
    if (!form.has(f.name)) continue
    let value = form.get(f.name)
    if (value === '') value = null
    else if (f.type === 'integer') value = Number(value)
    row[f.name] = value
  }
  return row
}

// The resource's single primary-key column (the row identity the edit/delete routes key
// on). Composite keys are out of scope for the MVP; falls back to `id` by convention.
function primaryKeyOf(schemaTable) {
  return schemaTable.columns.find((c) => c.primary)?.name ?? 'id'
}

// Row-level scoping (#104). A resource may declare `scope(user) -> filter`, a universal-orm
// filter that bounds every row op to the rows the user owns (e.g. `(u) => ({ user_id: u.id })`).
// The returned filter is AND-merged into list/count/load/update/delete and FORCED onto inserts,
// so a non-admin only ever sees, edits, or creates their own rows. Returning a falsy value means
// "no scoping" (full access) — the admin bypass is encoded in the function itself, e.g.
// `(u) => (u.role === 'admin' ? null : { user_id: u.id })`. A resource with no `scope` is
// unscoped (the original behaviour), so this is purely additive.
function scopeFilter(resource, user) {
  if (typeof resource.scope !== 'function') return {}
  return resource.scope(user) ?? {}
}

// Force a scope's scalar owner columns onto a row/patch, so a scoped user can neither create
// a row owned by someone else nor reassign ownership on edit (a forged `user_id` in the form
// is overwritten). Only scalar equalities are forced; an `in`-style scope has no single value
// to assign, so it bounds reads/edits but not writes. Returns the same object, mutated.
function applyScopeOwnership(obj, scope) {
  for (const [col, val] of Object.entries(scope)) {
    if (val !== null && typeof val !== 'object') obj[col] = val
  }
  return obj
}

// /admin — the dashboard: the resources this install composed, filtered to what the
// signed-in user may view. Each card links to its list.
export function dashboardData(pageContext) {
  const user = pageContext.user
  const resources = getResources(pageContext.config)
    .filter((r) => canView(r, user))
    .map((r) => ({ table: r.table, label: resourceLabel(r), icon: r.icon ?? null }))
  return { resources }
}

// The default rows-per-page for the admin list. Surfaced in the returned view-model
// (no silent cap) so the page can show an honest "Page X of Y".
const DEFAULT_PAGE_SIZE = 20

// /admin/:table — the list, PAGED, SORTED and optionally FILTERED. Reads either:
//   - the discrete params the list UI uses: `?page=` (1-based), `?sort=` (a sortable
//     column), `?dir=` (asc|desc); or
//   - a single `?query=` (URL-encoded JSON: filter / orderBy / limit / offset), the
//     narrow universal-orm surface (#86) the agent API (#113) speaks. It is parsed +
//     VALIDATED against this resource's columns (query.js); an unknown column / operator
//     is a 400, never a silent or SQL-smuggling read.
// Either way the caller's filter is AND-merged UNDER the row scope (#104) so it can only
// NARROW the result, never widen past what the user is allowed to see. Asks universal-orm
// for the total count and just that window of rows, then returns the page/sort state the
// list UI needs. Unknown / unviewable tables bounce to the dashboard.
export async function listData(pageContext) {
  const { table } = pageContext.routeParams
  const resource = findResource(pageContext.config, table)
  if (!resource || !canView(resource, pageContext.user)) throw redirect('/admin')

  const tables = resolveAdminTables(pageContext.config)
  const schemaTable = tableNamed(tables, table)
  if (!schemaTable) throw redirect('/admin')

  const columns = viewColumns(resource, schemaTable)
  const db = buildDb(tables)

  const search = pageContext.urlParsed?.search ?? {}

  // Parse + validate the caller's `?query=` (filter / orderBy / limit / offset) against
  // this resource's columns. A bad query is the caller's fault: record it on pageContext so
  // the agent API (#113) returns a 400 with the message, and fall back to an empty query so
  // the HTML list still renders its scope-only view. (We avoid render(400): Vike recommends
  // against a 400 status there, and it would need an error page just for the JSON path.)
  let query
  try {
    query = parseListQuery(search.query, columns)
  } catch (err) {
    if (!(err instanceof QueryError)) throw err
    pageContext.adminApiError = err.message
    query = { filter: {} }
  }

  // Row scoping: AND-merge the scope filter LAST so it always wins — the caller's filter
  // can add conditions but can never override a scoped column (#104). Empty when the
  // resource is unscoped (admin / no scope).
  const scope = scopeFilter(resource, pageContext.user)
  const where = { ...query.filter, ...scope }

  // Sort: a validated `?query=` orderBy wins; otherwise the discrete `?sort=`/`?dir=`,
  // honouring only a column the resource marked `sortable`.
  const sortable = new Set(columns.filter((c) => c.sortable).map((c) => c.name))
  const discreteSort = sortable.has(search.sort) ? search.sort : null
  const orderBy = query.orderBy ?? (discreteSort ? [{ column: discreteSort, dir: search.dir === 'desc' ? 'desc' : 'asc' }] : undefined)
  const sort = orderBy?.[0]?.column ?? null
  const dir = orderBy?.[0]?.dir ?? 'asc'

  const total = await db[table].count(where)

  // Window: an explicit `?query=` limit/offset (agent style) is used verbatim; otherwise
  // the list UI's page model. Page/pageCount are derived for the returned view-model so
  // the UI can show an honest "Page X of Y" in both modes.
  let pageSize, offset
  if (query.limit != null) {
    pageSize = query.limit
    offset = query.offset ?? 0
  } else {
    pageSize = DEFAULT_PAGE_SIZE
    const pageCountForClamp = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(Math.max(1, Number(search.page) || 1), pageCountForClamp)
    offset = (page - 1) * pageSize
  }
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.floor(offset / pageSize) + 1, pageCount)

  const rows = await db[table].find(where, { limit: pageSize, offset, orderBy })
  const fkLabels = await fkLabelsFor(columns, schemaTable, { db, config: pageContext.config, tables })

  return {
    table,
    label: resourceLabel(resource),
    columns,
    rows,
    fkLabels, // { column -> { value -> title } } so FK cells show the referenced row's title
    pk: primaryKeyOf(schemaTable), // the row identity the Edit links key on
    canEdit: canEdit(resource, pageContext.user),
    // paging + sort state for the list UI
    page,
    pageCount,
    pageSize,
    total,
    sort, // active sort column, or null
    dir, // 'asc' | 'desc'
  }
}

// /admin/:table/new — renders the create form (GET) and performs the insert (POST). The
// POST reads the normalized form data (./request.js), coerces each value by its field
// type, fills a missing string/uuid primary key, inserts through universal-orm, and
// redirects back to the list. universal-orm rejects unknown columns, so a stray field is
// a clear error.
export async function newData(pageContext) {
  const { table } = pageContext.routeParams
  const resource = findResource(pageContext.config, table)
  if (!resource || !canEdit(resource, pageContext.user)) throw redirect('/admin')

  const tables = resolveAdminTables(pageContext.config)
  const schemaTable = tableNamed(tables, table)
  if (!schemaTable) throw redirect('/admin')

  const fields = viewFields(resource, schemaTable)
  const db = buildDb(tables)
  const req = readFormRequest(pageContext)

  if (req.method === 'POST') {
    const row = rowFromForm(fields, await req.formData())

    // Fill a client-generatable primary key (uuid/string) the form doesn't carry, so a
    // minimal resource still inserts. Integer/auto keys are left to the database.
    const pk = schemaTable.columns.find((c) => c.primary)
    if (pk && row[pk.name] == null && (pk.type === 'uuid' || pk.type === 'string')) {
      row[pk.name] = randomUUID()
    }

    // Row scoping (#104): force the owner columns so a scoped user can only create rows they own.
    applyScopeOwnership(row, scopeFilter(resource, pageContext.user))

    await db[table].insert(row)
    throw redirect(`/admin/${table}`)
  }

  return { table, label: resourceLabel(resource), fields: await loadFkOptions(fields, { db, config: pageContext.config, tables }) }
}

// /admin/:table/:id — the detail/edit page. GET loads the row by its primary key and
// pre-fills the form; POST either UPDATES it (default) or DELETES it (an `_action=delete`
// field, from the Delete control), then redirects to the list. Gated by `canEdit`; an
// unknown id bounces back to the list. The static `/new` route keeps precedence over this
// `@id` param, so creating never collides with editing.
export async function editData(pageContext) {
  const { table, id } = pageContext.routeParams
  const resource = findResource(pageContext.config, table)
  if (!resource || !canEdit(resource, pageContext.user)) throw redirect('/admin')

  const tables = resolveAdminTables(pageContext.config)
  const schemaTable = tableNamed(tables, table)
  if (!schemaTable) throw redirect('/admin')

  const fields = viewFields(resource, schemaTable)
  const pk = primaryKeyOf(schemaTable)
  const db = buildDb(tables)
  const req = readFormRequest(pageContext)

  // Row scoping (#104): every op keys on the primary key AND the scope, so a scoped user
  // can only load / edit / delete a row they own — guessing another owner's id matches
  // nothing (load -> redirect, update/delete -> no-op).
  const scope = scopeFilter(resource, pageContext.user)
  const owned = { ...scope, [pk]: id }

  if (req.method === 'POST') {
    const form = await req.formData()
    if (form.get('_action') === 'delete') {
      await db[table].delete(owned)
    } else {
      // Re-assert ownership on the patch so the edit can't reassign the row to another owner.
      await db[table].update(owned, applyScopeOwnership(rowFromForm(fields, form), scope))
    }
    throw redirect(`/admin/${table}`)
  }

  const values = await db[table].findOne(owned)
  if (!values) throw redirect(`/admin/${table}`) // deleted, never existed, or not the user's

  const withOptions = await loadFkOptions(fields, { db, config: pageContext.config, tables })
  return { table, label: resourceLabel(resource), fields: withOptions, values, id, pk }
}
