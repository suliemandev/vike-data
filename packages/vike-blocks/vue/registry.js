// The block-renderer registry for Vue — the Vue twin of vike-blocks/react's registry. Same
// kit-backed mechanism, in the 'blocks'/'vue' slot, so vike-view/vue and any third-party Vue
// element register into ONE shared map that <Blocks> dispatches on. Plain JS (no template) so
// it is unit-testable under node:test.
import { createComponentRegistry } from '@vike-data/kit'

const registry = createComponentRegistry('blocks', 'vue')

// Register (or override) the Vue component for a block type.
export function registerBlockRenderer(type, component) {
  return registry.register(type, component)
}

// The component for a block type, or undefined when none is registered.
export function getBlockRenderer(type) {
  return registry.get(type)
}

// The block types that have a registered Vue renderer.
export function blockRendererTokens() {
  return registry.tokens()
}
