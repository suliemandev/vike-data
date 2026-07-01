// The composer: a PAGE is a composition of BLOCKS — the UI/UX schema, distinct from any data
// schema. `definePage({ route, sections })` declares which blocks a page is made of and,
// optionally, the route it mounts at; `resolvePage` turns those block descriptors into plain,
// serializable view-models a renderer can draw. vike-view wraps this as `defineView`, its
// schema-flavored entry.
//
//   definePage({
//     route: '/dashboard',
//     sections: [
//       heading('Welcome'),
//       { block: 'stat',     title: 'Revenue', source: 'orders.sum(total)' },
//       { block: 'markdown', source: '# Notes' },
//       { block: 'custom',   component: 'MyChart' },
//     ],
//   })
import { getBlock, listBlocks } from './registry.js'

// Normalize a section list: flatten one level (so a preset that returns several blocks mixes
// with single blocks in the same array), collapse element builders to plain specs, and
// validate each carries a `block` type.
function normalizeSections(sections) {
  if (!Array.isArray(sections)) throw new Error('definePage: `sections` must be an array of blocks')
  const flat = sections.flat().filter((s) => s != null)
  return flat.map((entry, i) => {
    const section = entry.build ? entry.build() : entry
    if (!section || typeof section !== 'object' || typeof section.block !== 'string' || !section.block) {
      throw new Error(`definePage: section ${i} must be a block descriptor, e.g. { block: "list", table: "posts" }`)
    }
    return { ...section }
  })
}

// Declare a page. `sections` (the blocks the page is composed of) is required; `route` is the
// path the page mounts at (optional — a page can also be mounted manually by a renderer).
// Everything else (guard, label, ...) passes through for the renderer / page generator.
export function definePage(def) {
  if (!def || typeof def !== 'object') {
    throw new Error('definePage: expected a definition object, e.g. definePage({ route: "/", sections: [...] })')
  }
  if (def.route != null && typeof def.route !== 'string') {
    throw new Error('definePage: `route`, when set, must be a string path')
  }
  const { route, sections, ...rest } = def
  return { route: route ?? null, sections: normalizeSections(sections), ...rest }
}

// Resolve a page's blocks against the (optional) merged schema into serializable view-models.
// Each resolved section is `{ block, props, resolved }`: `props` is the descriptor minus its
// `block` type; `resolved` is the block's view-model (a schema-derived block fills it from the
// schema, a bespoke block echoes its props). An unknown block type is a clear error listing
// what IS registered — never a silently dropped section.
export function resolvePage(page, tables) {
  const sections = (page?.sections ?? []).map(({ block, ...props }) => {
    const def = getBlock(block)
    if (!def) {
      throw new Error(`resolvePage: unknown block "${block}". Registered blocks: ${listBlocks().join(', ')}`)
    }
    const resolved = def.resolve ? def.resolve({ props, tables }) : { ...props }
    return { block, props, resolved }
  })
  return { route: page?.route ?? null, sections }
}
