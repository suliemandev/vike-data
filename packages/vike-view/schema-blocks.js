// The schema-driven blocks — vike-view's contribution to vike-blocks' registry. Where a
// bespoke block (stat/markdown/custom) carries its own props, a `list`/`record`/`form` block
// DERIVES its view-model from the composed schema through the crud engine (viewColumns /
// viewRecord / viewFields) — the same derivation the crud preset uses, no second copy.
// Importing this module registers the three blocks into the shared registry.
import { registerBlock } from 'vike-blocks'
import { crud } from './define.js'
import { tableNamed, viewColumns, viewRecord, viewFields } from './resolve.js'

// A table-derived block treats its own props as a crud() config (table + the same
// list/record/form/scope refinements), so the three blocks reuse the crud derivation exactly.
function tableFor(props, tables) {
  if (typeof props?.table !== 'string' || !props.table) {
    throw new Error('a table block needs a `table` name, e.g. { block: "list", table: "posts" }')
  }
  if (!Array.isArray(tables)) {
    throw new Error('resolveView: pass the composed tables as the second argument, e.g. resolveView(view, resolveViewTables(config))')
  }
  const table = tableNamed(tables, props.table)
  if (!table) throw new Error(`block table "${props.table}" is not in the composed schema`)
  return table
}

registerBlock('list', {
  resolve({ props, tables }) {
    const table = tableFor(props, tables)
    return { table: props.table, columns: viewColumns(crud(props), table) }
  },
})
registerBlock('record', {
  resolve({ props, tables }) {
    const table = tableFor(props, tables)
    return { table: props.table, fields: viewRecord(crud(props), table) }
  },
})
registerBlock('form', {
  resolve({ props, tables }) {
    const table = tableFor(props, tables)
    return { table: props.table, fields: viewFields(crud(props), table) }
  },
})

// The crud PRESET as blocks: expand a table into its list + record + form block descriptors,
// so `sections: crudBlocks({ table: 'posts' })` drops the full CRUD triad into a page. Each
// block carries ONLY the keys it reads (its own refinement array), so the three descriptors
// share no nested references and — crucially — the crud config's `scope`/`canView`/`canEdit`
// FUNCTIONS never ride into a block descriptor (those are server-side data concerns; a block
// descriptor is serializable data handed to the renderer/client). Row scoping for a rendered
// crud page is wired server-side through the data layer, not through the serialized block.
export function crudBlocks(opts) {
  const cfg = crud(opts) // validates `table`
  // Collapse the column()/display()/field() BUILDERS in a refinement array to plain specs, so the
  // block descriptor stays serializable: it rides in a section's `props`, which Vike serializes to
  // the client, and a builder carries function methods (.sortable(), .build()) that can't cross
  // that boundary. resolve.js already accepts either a builder or a plain spec, so nothing downstream
  // changes. (A view built by hand can also pass plain specs directly.)
  const plain = (arr) => arr?.map((e) => (typeof e?.build === 'function' ? e.build() : e))
  return [
    { block: 'list', table: cfg.table, ...(cfg.list ? { list: plain(cfg.list) } : {}) },
    { block: 'record', table: cfg.table, ...(cfg.record ? { record: plain(cfg.record) } : {}) },
    { block: 'form', table: cfg.table, ...(cfg.form ? { form: plain(cfg.form) } : {}) },
  ]
}
