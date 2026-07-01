// The field-widget registry now lives in vike-view/react (the form layer vike-admin is a preset
// over); this module re-exports it so vike-admin's public surface
// (`registerFieldWidget` / `getFieldWidget` / `fieldWidgetTokens`) is unchanged. Both bind kit's
// shared 'react' slot, so a widget registered on either side is visible to the other.
export { registerFieldWidget, getFieldWidget, fieldWidgetTokens } from 'vike-view/react/widget-registry'
