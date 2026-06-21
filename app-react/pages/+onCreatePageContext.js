// Read the theme cookie server-side so the ThemeProvider can SSR the correct
// theme (no dark/light flash on first paint). vike-auth's own onCreatePageContext
// runs too (cumulative) and sets pageContext.user — this only adds the theme.
export default function onCreatePageContext(pageContext) {
  const cookie = pageContext.headers?.cookie || ''
  const match = /(?:^|;\s*)vike_theme=([^;]+)/.exec(cookie)
  // Null when there is no cookie, so the app's defaultTheme (in +Layout) decides
  // the first-visit theme rather than this hook hardcoding one.
  pageContext.themeCookie = match ? decodeURIComponent(match[1]) : null
}
