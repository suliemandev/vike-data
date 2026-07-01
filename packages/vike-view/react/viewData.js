// The generic Vike DATA hook shared by every generated view page. On GET it resolves the view
// for this route (from the `views` config point), hydrates its blocks (rows / values, owner-
// scoped) through the data layer, and returns the sections ViewPage renders. On POST it OWNS the
// write: it reads the submitted form (which carries `_table`, and `_id` on an edit), coerces it
// to a row, writes it through the scoped create/update path, and redirects back to the route —
// no separate endpoint, a plain SSR form post. Modeled on vike-admin's data hooks.
import { redirect } from 'vike/abort'
import { resolveViewTables, buildDb, hydrateView, createRow, updateRow } from '../index.js'
import { viewForRoute, formFieldsFor } from './pages.js'
import { readFormRequest } from './request.js'

export async function viewData(pageContext) {
  const config = pageContext.config
  const route = pageContext.urlPathname
  const view = viewForRoute(config?.views, route)
  if (!view) return { route, sections: [] }

  const tables = resolveViewTables(config)
  const db = buildDb(tables)
  const ctx = { user: pageContext.user }
  const scope = view.scope // optional (table, ctx) => filter — the owner contract wires row scoping

  const req = readFormRequest(pageContext)
  if (req.method === 'POST') {
    const form = await req.formData()
    const table = form.get('_table')
    const fields = table ? formFieldsFor(view, tables, table) : null
    if (table && fields) {
      const id = form.get('_id')
      if (id) await updateRow(db, tables, table, fields, id, form, { scope, ctx })
      else await createRow(db, tables, table, fields, form, { scope, ctx })
    }
    // Back to the list; the GET re-hydrates and shows the change.
    throw redirect(route)
  }

  const search = pageContext.urlParsed?.search ?? {}
  const hydrated = await hydrateView(view, { tables, db, scope, ctx, search })
  return { route: hydrated.route, sections: hydrated.sections }
}
