export default {
  name: 'vike-themes-vue',
  extends: ['import:vike-themes/config:default'],
  // vike-vue has no `Wrapper` config (unlike vike-react) — it only has the
  // cumulative `Layout`. The theme provider goes there; cumulative Layouts nest, so
  // it composes with the shell layout (vike-layouts) and the other providers. The
  // provider injects the `:root` theme variables + mounts the live theme picker.
  Layout: 'import:vike-themes/vue/ThemeWrapper:default',
}
