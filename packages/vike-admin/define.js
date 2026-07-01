// The view DSL now lives in vike-view's framework-agnostic core. `defineResource` is
// vike-admin's historical name for `defineView`; kept as an alias so existing admin
// resources and tests keep working. `display` (the record-view builder) is re-exported
// too for parity.
export { defineView as defineResource, defineView, column, display, field } from 'vike-view/define'
