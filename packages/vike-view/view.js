// The top-level primitive: a VIEW is a page composed of BLOCKS — the UI/UX schema, distinct
// from the data schema (vike-schema). `defineView({ route, sections })` declares which blocks
// a page is made of and, optionally, the route that page mounts at; `resolveView` turns those
// block descriptors into plain, serializable view-models a renderer can draw.
//
//   defineView({
//     route: '/dashboard',
//     sections: [
//       { block: 'stat',     title: 'Revenue', source: 'orders.sum(total)' },
//       { block: 'list',     table: 'orders' },        // schema-derived (the crud engine)
//       { block: 'markdown', source: '# Welcome' },
//       { block: 'custom',   component: 'MyChart' },    // your own component
//       ...crudBlocks({ table: 'posts' }),              // the crud preset: list + record + form
//     ],
//   })
//
// A `list`/`record`/`form` block derives from the schema through the same crud derivation
// core; a bespoke block (stat/markdown/custom) carries its own props; the genuine long tail
// ejects to `block: 'custom'` or an AI-generated page. No layout/expression DSL — that is the
// low-code trap this deliberately avoids.
import { getBlock, listBlocks } from './blocks.js'

// Normalize a section list: flatten one level (so `crudBlocks(...)` and single blocks mix in
// the same array), collapse builders to plain specs, and validate each carries a `block` type.
function normalizeSections(sections) {
  if (!Array.isArray(sections)) throw new Error('defineView: `sections` must be an array of blocks')
  const flat = sections.flat().filter((s) => s != null)
  return flat.map((entry, i) => {
    const section = entry.build ? entry.build() : entry
    if (!section || typeof section !== 'object' || typeof section.block !== 'string' || !section.block) {
      throw new Error(`defineView: section ${i} must be a block descriptor, e.g. { block: "list", table: "posts" }`)
    }
    return { ...section }
  })
}

// Declare a view. `sections` (the blocks the page is composed of) is required; `route` is the
// path the page mounts at (optional — a view can also be mounted manually by a renderer).
// Everything else (guard, label, ...) passes through for the renderer / page generator.
export function defineView(def) {
  if (!def || typeof def !== 'object') {
    throw new Error('defineView: expected a definition object, e.g. defineView({ route: "/", sections: [...] })')
  }
  if (def.route != null && typeof def.route !== 'string') {
    throw new Error('defineView: `route`, when set, must be a string path')
  }
  const { route, sections, ...rest } = def
  return { route: route ?? null, sections: normalizeSections(sections), ...rest }
}

// Resolve a view's blocks against the merged schema into serializable view-models. Each
// resolved section is `{ block, props, resolved }`: `props` is the descriptor minus its
// `block` type; `resolved` is the block's view-model (a schema-derived block fills it from
// the schema, a bespoke block echoes its props). An unknown block type is a clear error
// listing what IS registered — never a silently dropped section.
export function resolveView(view, tables) {
  const sections = (view?.sections ?? []).map(({ block, ...props }) => {
    const def = getBlock(block)
    if (!def) {
      throw new Error(`resolveView: unknown block "${block}". Registered blocks: ${listBlocks().join(', ')}`)
    }
    const resolved = def.resolve ? def.resolve({ props, tables }) : { ...props }
    return { block, props, resolved }
  })
  return { route: view?.route ?? null, sections }
}
