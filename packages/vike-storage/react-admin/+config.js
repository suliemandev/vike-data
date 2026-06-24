// vike-storage/react-admin - the storage-to-admin bridge (React).
//
// Install it alongside vike-admin (extends: [storageAdminExt]) to register the `file` widget,
// so any column declared `.as('file')` renders vike-storage's upload control in the admin form,
// with no bespoke admin code. It contributes a passthrough Layout whose module performs the
// registration (see ../react/AdminFileRegister.jsx), so the widget is present in both the SSR
// and the client bundle (no hydration mismatch).
//
// It is a Vike `+config.js` (not a plain module) because an `extends` target must be one - Vike
// rewrites each `extends` entry to a pointer-import of a config file. Kept separate from
// vike-storage/react so vike-storage works without vike-admin; this is the opt-in seam between
// the two. Requires vike-admin (an optional peer dependency of vike-storage).
export default {
  name: 'vike-storage-admin',
  Layout: 'import:vike-storage/react/AdminFileRegister:default',
}
