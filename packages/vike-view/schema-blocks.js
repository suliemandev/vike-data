// The schema-driven blocks — vike-view's contribution to vike-elements' registry. Where a
// bespoke block (stat/markdown/custom) carries its own props, a `list`/`record`/`form` block
// DERIVES its view-model from the composed schema through the crud engine (viewColumns /
// viewRecord / viewFields) — the same derivation the crud preset uses, no second copy.
// Importing this module registers the three blocks into the shared registry.
import { registerBlock } from 'vike-elements'
import { crud } from './define.js'
import { tableNamed, viewColumns, viewRecord, viewFields } from './resolve.js'

// A table-derived block treats its own props as a crud() config (table + the same
// list/record/form/scope refinements), so the three blocks reuse the crud derivation exactly.
function tableFor(props, tables) {
  if (typeof props?.table !== 'string' || !props.table) {
    throw new Error('a table block needs a `table` name, e.g. { block: "list", table: "posts" }')
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
// block carries the same props, and each block's resolve reads only the refinement it needs
// (list reads `.list`, record `.record`, form `.form`), so extra keys are harmless.
export function crudBlocks(opts) {
  const cfg = crud(opts) // validates `table`
  return [
    { block: 'list', ...cfg },
    { block: 'record', ...cfg },
    { block: 'form', ...cfg },
  ]
}
