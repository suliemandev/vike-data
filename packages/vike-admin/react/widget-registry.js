// The field-widget registry: maps a field's `widget` token (the rendering token derived in
// resolve.js from a column's `.as()` semantic, #176) to the React control that edits it. This
// is the layer-2 seam of the schema-driven UI epic (#174): the schema declares a column's
// MEANING (layer 1, universal-schema); vike-admin derives the editable control here.
//
// The registry MECHANISM now lives in `@vike-data/kit` (createFieldWidgetRegistry), promoted
// out of vike-admin per the Option D decision in #185 once a second consumer of the schema
// became foreseeable. This module is the thin React binding: it creates the shared 'react'
// registry and re-exports it under vike-admin's existing names, so vike-admin's public surface
// (`registerFieldWidget` / `getFieldWidget` / `fieldWidgetTokens`) is unchanged.
//
// Because the map is shared (kit keys it by name on globalThis), an extension can teach the
// admin a new field kind WITHOUT depending on vike-admin: it registers into kit's 'react'
// registry directly (vike-storage registers a `file` upload control, #178), and any consumer
// that reads the same registry (vike-admin today, a future vike-landing / vike-email-editor)
// renders it with no bespoke code. A token the registry doesn't know falls back to the plain
// text input (see FormFields), so an unrecognized semantic degrades gracefully.
//
// The built-in widget COMPONENTS live in ./widgets.jsx and register themselves here; this
// module stays JSX-free (plain data + functions) so it is unit-testable under node:test.
import { createFieldWidgetRegistry } from '@vike-data/kit'

const registry = createFieldWidgetRegistry('react')

// Register (or override) the control for a widget token. Delegates to the shared kit registry;
// validation + idempotent override live there.
export function registerFieldWidget(token, component) {
  return registry.register(token, component)
}

// The control for a token, or undefined when none is registered (the caller falls back).
export function getFieldWidget(token) {
  return registry.get(token)
}

// The registered tokens, for introspection and tests.
export function fieldWidgetTokens() {
  return registry.tokens()
}
