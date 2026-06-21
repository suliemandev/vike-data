// Read the locale cookie into pageContext so a runtime locale picker survives a
// reload and SSRs without a mismatch. Framework-agnostic (cookie parsing only).
// Null when absent, so the active locale falls back to pageContext.locale (Vike
// routing) or the app's configured `locale` default rather than a hardcoded one.
export default function onCreatePageContext(pageContext) {
  const cookie = pageContext.headers?.cookie || ''
  const match = /(?:^|;\s*)vike_locale=([^;]+)/.exec(cookie)
  pageContext.localeCookie = match ? decodeURIComponent(match[1]) : null
}
