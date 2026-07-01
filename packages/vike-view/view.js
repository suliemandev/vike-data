// `defineView` — vike-view's schema-flavored page entry. It is the same composer as
// vike-elements' `definePage`, but importing it guarantees the schema-derived blocks
// (list/record/form) are registered, so `defineView({ sections: crudBlocks(...) })` and the
// `{ block: 'list', table }` shorthand resolve out of the box. Bare `definePage` (from
// vike-elements) composes only the blocks that happen to be registered.
import { definePage } from 'vike-elements'
import './schema-blocks.js' // side-effect: register list / record / form into the registry

export function defineView(def) {
  return definePage(def)
}
