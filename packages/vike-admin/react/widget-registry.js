// The field-widget registry: maps a field's `widget` token (the rendering token derived in
// resolve.js from a column's `.as()` semantic, #176) to the React control that edits it. This
// is the layer-2 seam of the schema-driven UI epic (#174): the schema declares a column's
// MEANING (layer 1, universal-schema); vike-admin derives the editable control here.
//
// The registry is OPEN. An extension teaches the admin a new field kind by calling
// `registerFieldWidget(token, Component)` — e.g. vike-storage registers a `file` upload control
// (#178), so a column marked `.as('file')` renders without any bespoke admin code. A token the
// registry doesn't know falls back to the plain text input (see FormFields), so an unrecognized
// semantic degrades gracefully instead of throwing.
//
// Kept INSIDE vike-admin on purpose. A second consumer of the schema (a read-only `vike-landing`,
// a `vike-email-editor`) would render the SAME semantic types into a DIFFERENT medium, so the
// registry MECHANISM is a promote-to-`@vike-data/kit` candidate only once that second consumer
// exists. Extracting it now, over a single example, would be speculative — the same discipline
// that delayed `createPort` until it had repeated.
//
// This module is intentionally JSX-free (plain data + functions) so it is unit-testable under
// node:test; the built-in widget COMPONENTS live in ./widgets.jsx and register themselves here.

const registry = new Map()

// Register (or override) the control for a widget token. Idempotent: a later call wins, so an
// app can swap a built-in. Validated so a typo'd token or a non-component fails loudly at
// registration, not silently at render.
export function registerFieldWidget(token, component) {
  if (typeof token !== 'string' || token === '') {
    throw new Error('registerFieldWidget(token, component): token must be a non-empty string')
  }
  if (typeof component !== 'function') {
    throw new Error(`registerFieldWidget(${JSON.stringify(token)}, component): component must be a function`)
  }
  registry.set(token, component)
  return component
}

// The control for a token, or undefined when none is registered (the caller falls back).
export function getFieldWidget(token) {
  return registry.get(token)
}

// The registered tokens — for introspection and tests.
export function fieldWidgetTokens() {
  return [...registry.keys()]
}
