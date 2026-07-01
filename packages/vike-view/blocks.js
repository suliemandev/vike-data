// The block registry — the open set of block types a view can compose. A BLOCK is one
// section of a page: a `{ block: <type>, ...props }` descriptor. Some blocks are
// schema-derived (list / record / form of a table, resolved through the SAME derivation
// core the crud preset uses — no second implementation); others are bespoke (stat /
// markdown / custom), whose view-model is just their props.
//
// The registry is OPEN (the same pattern as the field-widget registry, one level up): an
// extension registers its own block with `registerBlock(type, def)`, so a new block type
// ships alongside the component that renders it, with no change to vike-view. The genuine
// long tail that no block expresses drops to `block: 'custom'` (your component) or an
// AI-ejected real page — vike-view stays a composition of blocks, not a layout DSL.
//
// A block DEFINITION is `{ resolve?({ props, tables }) -> model }`: the framework-agnostic
// step that turns a descriptor into a plain, serializable view-model (e.g. a list block
// resolves its columns from the schema). A block with no `resolve` passes its props through
// unchanged (stat / markdown / custom). Rendering a model to components is the renderer's
// job (vike-react-view), keyed on the same block type.
import { crud } from './define.js'
import { tableNamed, viewColumns, viewRecord, viewFields } from './resolve.js'

const REGISTRY = new Map()

// Register (or override) a block type. `def.resolve` is optional; a block without it is a
// pass-through (its resolved model is its props). Throws on a bad type/def so a typo is a
// clear error, not a silently ignored block.
export function registerBlock(type, def = {}) {
  if (typeof type !== 'string' || !type) throw new Error('registerBlock: a non-empty string type is required')
  if (def == null || typeof def !== 'object') throw new Error(`registerBlock(${JSON.stringify(type)}): def must be an object`)
  if (def.resolve != null && typeof def.resolve !== 'function') {
    throw new Error(`registerBlock(${JSON.stringify(type)}): def.resolve must be a function`)
  }
  REGISTRY.set(type, { type, resolve: def.resolve ?? null })
  return def
}

export const getBlock = (type) => REGISTRY.get(type) ?? null
export const hasBlock = (type) => REGISTRY.has(type)
export const listBlocks = () => [...REGISTRY.keys()]

// A table-derived block treats its own props as a crud() config (table + the same
// list/record/form/scope refinements), so the three schema-derived blocks reuse the crud
// derivation core exactly instead of re-deriving columns/fields. Shared by list/record/form.
function tableFor(props, tables) {
  if (typeof props?.table !== 'string' || !props.table) {
    throw new Error('a table block needs a `table` name, e.g. { block: "list", table: "posts" }')
  }
  const table = tableNamed(tables, props.table)
  if (!table) throw new Error(`block table "${props.table}" is not in the composed schema`)
  return table
}

// The built-in blocks. list/record/form derive from the schema via the crud engine; stat/
// markdown/custom are bespoke pass-throughs. Registered at import; an app or extension can
// override any of them or add more with registerBlock.
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
registerBlock('stat', {}) // { title, source|value } — pass-through
registerBlock('markdown', {}) // { source } — pass-through
registerBlock('custom', {}) // { component } — the renderer imports the component — pass-through

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
