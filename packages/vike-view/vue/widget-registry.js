// The field-widget registry for Vue — the Vue twin of vike-view/react/widget-registry.js. A thin
// binding over kit's shared 'vue' field-widget slot, so vike-view/vue's FormView, a future
// vike-admin/vue, and an extension's Vue control all read/register the SAME map. This is the Vue
// widget registry that was a "fast follow" in the admin's Vue FormFields — now real. Plain JS.
import { createFieldWidgetRegistry } from '@vike-data/kit'

const registry = createFieldWidgetRegistry('vue')

export function registerFieldWidget(token, component) {
  return registry.register(token, component)
}

export function getFieldWidget(token) {
  return registry.get(token)
}

export function fieldWidgetTokens() {
  return registry.tokens()
}
