// The block registry — the open set of block types a page can compose. A BLOCK is one
// section of a page: a `{ block: <type>, ...props }` descriptor. Most blocks are bespoke
// (their view-model is just their props); a block can also be schema/data-aware by carrying
// a `resolve` (vike-view's list/record/form register their derivation this way).
//
// The registry is OPEN: an extension registers its own block with `registerBlock(type, def)`
// (or, for a leaf element with a fluent builder, `defineElement`), so a new block type ships
// alongside the component that renders it, with no change to vike-elements. The genuine long
// tail that no block expresses drops to `block: 'custom'` (your component) or an AI-ejected
// real page — this stays a composition of blocks, not a layout DSL.
//
// A block DEFINITION is `{ resolve?({ props, tables }) -> model }`: the framework-agnostic
// step that turns a descriptor into a plain, serializable view-model. A block with no
// `resolve` passes its props through unchanged. Rendering a model to components is the
// renderer's job (a per-framework package), keyed on the same block type.

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

// Define an ELEMENT — a leaf block with a fluent authoring builder — in ONE call. This is the
// high-DX seam: a package ships a new element (its builder + descriptor shape + registry
// entry) with a single `defineElement`, and registers the matching renderer per framework
// separately (`registerElementRenderer`, in the framework package).
//
//   export const rating = defineElement('rating', {
//     build:  (value) => ({ value }),                 // rating(3) -> { block:'rating', value:3 }
//     refine: { max: (n) => ({ max: n }), readonly: () => ({ readonly: true }) },
//   })
//   // author usage:  rating(3).max(5).readonly()
//
// `build(...args)` produces the base props; `refine` maps chainable method names to prop
// patches; `resolve` (optional) makes the element schema/data-aware instead of a pass-through.
// Returns the builder FACTORY; calling it yields a chainable builder whose `.build()` collapses
// to a `{ block, ...props }` descriptor — exactly what a view's `sections` accepts.
export function defineElement(type, { build, refine = {}, resolve } = {}) {
  if (build != null && typeof build !== 'function') throw new Error(`defineElement(${JSON.stringify(type)}): build must be a function`)
  if (refine == null || typeof refine !== 'object') throw new Error(`defineElement(${JSON.stringify(type)}): refine must be an object of functions`)
  registerBlock(type, resolve ? { resolve } : {})
  return (...args) => {
    const spec = build ? { ...build(...args) } : { ...(args[0] ?? {}) }
    const self = {}
    for (const name of Object.keys(refine)) {
      const patch = refine[name]
      self[name] = (...a) => {
        Object.assign(spec, patch(...a))
        return self
      }
    }
    self.build = () => ({ block: type, ...spec })
    return self
  }
}
