// The page-generation glue: turn a list of `defineView`s into Vike `config.pages`, and (at
// request time) resolve which view a page is for. An app declares its views and spreads
// `viewPages(views)` into its `+config.js` `pages`, so each view.route becomes a real Vike page
// backed by ONE generic page (ViewPage) + ONE generic data hook (viewData); the hook reads the
// `views` config point to know which view this route is. Plain JS (no JSX) so it is testable.
import { resolvePage } from 'vike-elements'

// The config-time authoring surface, re-exported here so an app imports everything it declares its
// views with from ONE jsx-free entry: `import { defineView, crudBlocks, viewPages } from
// 'vike-view/react/pages'`. It must be jsx-free because +config.js and its +views file are loaded
// by Vike's Node config loader, which cannot transpile the .jsx the 'vike-view/react' barrel pulls
// in (the barrel is for RUNTIME page components). All of these come from the pure-JS core.
export { defineView, crudBlocks, crud, column, display, field } from '../index.js'

// A cumulative `views` config arrives as an array of per-source contributions; flatten it (an
// entry may be an array or a function returning one), matching how the schemas point flattens.
export function normalizeViews(views) {
  return (views ?? []).flatMap((v) => (typeof v === 'function' ? v() || [] : Array.isArray(v) ? v : v ? [v] : []))
}

// Build the Vike pages for a set of views: one page per view.route, all sharing the generic
// ViewPage + viewData (referenced by pointer-import strings, which Vike loads via Vite).
export function viewPages(views) {
  return normalizeViews(views)
    .filter((v) => typeof v?.route === 'string' && v.route)
    .map((v) => ({
      route: v.route,
      Page: 'import:vike-view/react/ViewPage:default',
      data: 'import:vike-view/react/viewData:viewData',
    }))
}

// The view whose route matches this page (the generic data hook resolves it at request time).
export function viewForRoute(views, route) {
  return normalizeViews(views).find((v) => v.route === route) ?? null
}

// The resolved form fields for a `form` block on `table` in this view — what the POST handler
// coerces the submitted form against.
export function formFieldsFor(view, tables, table) {
  const resolved = resolvePage(view, tables)
  const form = resolved.sections.find((s) => s.block === 'form' && s.props.table === table)
  return form?.resolved.fields ?? null
}
