// Programmatic surface of vike-view's framework-agnostic core. A preset (vike-admin) or a
// per-table view consumes these to derive a list / record / form view-model from the
// composed schema and run it over the app's ORM adapter. No React, no Vike.
export { crud, column, display, field } from './define.js'
export {
  resolveViewTables,
  tableNamed,
  viewLabel,
  canView,
  canEdit,
  buildDb,
  viewColumns,
  viewRecord,
  viewFields,
  recordTitleColumn,
  isHiddenColumn,
  titleCase,
  fkOf,
} from './resolve.js'
export { projectRow } from './project.js'
export { parseListQuery, QueryError, MAX_LIMIT } from './query.js'
