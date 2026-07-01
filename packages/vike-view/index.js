// Programmatic surface of vike-view — the schema-driven layer over vike-elements. It
// re-exports the vike-elements substrate (the composer, registry, defineElement, and the
// primitive elements) as a convenience umbrella, and adds the schema layer: crud derivation,
// the list/record/form blocks, and `defineView`. Importing anything here registers the
// schema-derived blocks. No React, no Vike.
export { definePage, resolvePage, registerBlock, getBlock, hasBlock, listBlocks, defineElement, text, heading, badge, divider, link } from 'vike-elements'
// `resolveView` is the schema-app's name for the generic `resolvePage` (kept for continuity).
export { resolvePage as resolveView } from 'vike-elements'
export { defineView } from './view.js' // side-effect: registers list / record / form
export { crudBlocks } from './schema-blocks.js'
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
