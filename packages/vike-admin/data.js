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
import {
  resolveAdminTables,
  getResources,
  findResource,
  tableNamed,
  resourceLabel,
  canView,
  canEdit,
  buildDb,
  viewColumns,
  viewFields,
} from './resolve.js'

// /admin — the dashboard: the resources this install composed, filtered to what the
// signed-in user may view. Each card links to its list.
export function dashboardData(pageContext) {
  const user = pageContext.user
  const resources = getResources(pageContext.config)
    .filter((r) => canView(r, user))
    .map((r) => ({ table: r.table, label: resourceLabel(r), icon: r.icon ?? null }))
  return { resources }
}

// /admin/:table — the list. Every row of the resource's table (universal-orm `find`
// returns all rows — no pagination yet, flagged in the epic), projected to the resolved
// columns. Unknown / unviewable tables bounce to the dashboard.
export async function listData(pageContext) {
  const { table } = pageContext.routeParams
  const resource = findResource(pageContext.config, table)
  if (!resource || !canView(resource, pageContext.user)) throw redirect('/admin')

  const tables = resolveAdminTables(pageContext.config)
  const schemaTable = tableNamed(tables, table)
  if (!schemaTable) throw redirect('/admin')

  const columns = viewColumns(resource, schemaTable)
  const db = buildDb(tables)
  const rows = await db[table].find({})

  return {
    table,
    label: resourceLabel(resource),
    columns,
    rows,
    canCreate: canEdit(resource, pageContext.user),
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
  const req = readFormRequest(pageContext)

  if (req.method === 'POST') {
    const form = await req.formData()
    const row = {}
    for (const f of fields) {
      if (f.type === 'boolean') {
        // An unchecked checkbox sends no value; treat absence as false.
        row[f.name] = form.get(f.name) === 'on' || form.get(f.name) === 'true'
        continue
      }
      if (!form.has(f.name)) continue
      let value = form.get(f.name)
      if (value === '') value = null
      else if (f.type === 'integer') value = Number(value)
      row[f.name] = value
    }

    // Fill a client-generatable primary key (uuid/string) the form doesn't carry, so a
    // minimal resource still inserts. Integer/auto keys are left to the database.
    const pk = schemaTable.columns.find((c) => c.primary)
    if (pk && row[pk.name] == null && (pk.type === 'uuid' || pk.type === 'string')) {
      row[pk.name] = randomUUID()
    }

    const db = buildDb(tables)
    await db[table].insert(row)
    throw redirect(`/admin/${table}`)
  }

  return { table, label: resourceLabel(resource), fields }
}
