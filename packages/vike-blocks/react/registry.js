// The block-renderer registry for React — the per-framework half of the block-rendering seam.
// Where `defineBlock`/`registerBlock` register a block's DESCRIPTOR + resolver (agnostic), this
// registers the React COMPONENT that draws a resolved block, keyed by the same block type. It
// is a thin binding over kit's generic `createComponentRegistry` in the `blocks` namespace, so
// vike-view (list/record/form), vike-blocks (the primitives), and any third-party
// `vike-block-*` all register into ONE shared map that `<Blocks>` dispatches on — no side
// depends on another. Plain JS (no JSX) so it is unit-testable under node:test.
import { createComponentRegistry } from '@vike-data/kit'

const registry = createComponentRegistry('blocks', 'react')

// Register (or override) the React component for a block type. A later call wins, so an app can
// swap a built-in renderer. Validated at registration (kit throws on a bad token/component).
export function registerBlockRenderer(type, component) {
  return registry.register(type, component)
}

// The component for a block type, or undefined when none is registered (so `<Blocks>` can skip
// or fall back rather than throw on an unrendered block type).
export function getBlockRenderer(type) {
  return registry.get(type)
}

// The block types that have a registered React renderer, for introspection/tests.
export function blockRendererTokens() {
  return registry.tokens()
}
