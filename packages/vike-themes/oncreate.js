// Read the theme cookie into pageContext so the runtime selection (the picker)
// survives a reload and SSRs without a flash. Framework-agnostic (cookie parsing
// only); the React binding resolves `themeCookie || config.theme` to the active
// theme. Null when there is no cookie, so the app's configured `theme` default
// decides the first visit rather than this hook hardcoding one.
export default function onCreatePageContext(pageContext) {
  const cookie = pageContext.headers?.cookie || ''
  const match = /(?:^|;\s*)vike_theme=([^;]+)/.exec(cookie)
  pageContext.themeCookie = match ? decodeURIComponent(match[1]) : null
}
