// The field-widget registry for React — maps a field's `widget` token (derived in resolve.js
// from a column's `.as()` semantic) to the control that edits it. A thin binding over kit's
// shared 'react' field-widget slot, so vike-view's FormView, vike-admin's form pages, and an
// extension's control (e.g. vike-storage's `file`) all read/register the SAME map — a column
// marked `.as('file')` renders the uploader in any vike-view form, not just the admin. Plain JS
// (no JSX) so it is unit-testable and importable without React. Built-in controls live in
// ./widgets.jsx and register themselves here.
import { createFieldWidgetRegistry } from '@vike-data/kit'

const registry = createFieldWidgetRegistry('react')

// Register (or override) the control for a widget token.
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
