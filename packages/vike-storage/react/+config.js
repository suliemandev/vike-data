// vike-storage/react - registers vike-storage's field widgets into the shared (kit) field-widget
// registry for React. Install it alongside vike-storage (extends: [storageReactExt]) so any column
// declared `.as('file')` renders vike-storage's upload control in whichever consumer reads the
// registry (vike-admin today; a future vike-landing / vike-email-editor), with no bespoke code.
//
// It contributes a passthrough Layout whose module performs the registration (see
// ./FieldWidgetRegister.jsx), so the widget is present in both the SSR and the client bundle (no
// hydration mismatch). It depends only on `@vike-data/kit`, never on vike-admin: neither core
// knows about the other (the Option D shape, #185); a new consumer gets `.as('file')` for free.
//
// It is a Vike `+config.js` (not a plain module) because an `extends` target must be one - Vike
// rewrites each `extends` entry to a pointer-import of a config file. Kept separate from
// vike-storage/config so vike-storage works headless without any UI.
export default {
  name: 'vike-storage-react',
  Layout: 'import:vike-storage/react/FieldWidgetRegister:default',
}
