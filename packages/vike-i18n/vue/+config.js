export default {
  name: 'vike-i18n-vue',
  extends: ['import:vike-i18n/config:default'],
  // vike-vue has no `Wrapper` config (unlike vike-react) — it only has the cumulative
  // `Layout`. The locale provider goes there; cumulative Layouts nest, so it wraps the
  // page (t() reaches every page) and composes with the other providers + the shell.
  Layout: 'import:vike-i18n/vue/LocaleWrapper:default',
  lang: 'import:vike-i18n/vue/html:lang',
  htmlAttributes: 'import:vike-i18n/vue/html:htmlAttributes',
}
