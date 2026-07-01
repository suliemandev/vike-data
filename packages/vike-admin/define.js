// The view DSL now lives in vike-view's framework-agnostic core. `defineResource` is
// vike-admin's historical name for the CRUD-per-table view, which vike-view now calls
// `crud`; kept as an alias so existing admin resources and tests keep working. `display`
// (the record-view builder) is re-exported too for parity.
export { crud as defineResource, column, display, field } from 'vike-view/define'
