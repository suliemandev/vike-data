// Read the theme + appearance cookies into pageContext so the runtime selection
// (the picker) survives a reload and SSRs without a flash. Framework-agnostic
// (cookie parsing only); the React binding resolves these against the configured
// defaults. Null when absent, so the app's configured `theme`/`appearance` decide
// the first visit rather than this hook hardcoding values.
const read = (cookie, name) => {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(cookie)
  return match ? decodeURIComponent(match[1]) : null
}

export default function onCreatePageContext(pageContext) {
  const cookie = pageContext.headers?.cookie || ''
  pageContext.themeCookie = read(cookie, 'vike_theme')
  pageContext.appearanceCookie = read(cookie, 'vike_appearance')
}
