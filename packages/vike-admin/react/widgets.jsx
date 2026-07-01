// The built-in field widgets now live in vike-view/react (vike-admin is a preset over it); this
// module re-exports them so `vike-admin/react/widgets` keeps working and importing it still
// registers the built-ins as a side effect. An extension can register a control against either
// vike-admin/react/widgets or vike-view/react/widgets — same shared 'react' slot.
export * from 'vike-view/react/widgets'
