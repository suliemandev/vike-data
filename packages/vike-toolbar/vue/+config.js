export default {
  name: 'vike-toolbar-vue',
  extends: ['import:vike-toolbar/config:default'],
  // vike-vue has no `Wrapper` config (unlike vike-react) — it only has the cumulative
  // `Layout`. The toolbar surface goes there; cumulative Layouts nest, so it mounts
  // around every page and its teleport target is present for the pickers to portal into.
  Layout: 'import:vike-toolbar/vue/ToolbarWrapper:default',
}
