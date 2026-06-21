// The React binding for vike-themes. Self-installs the core config (so the app
// only installs THIS), and contributes a vike-react `Wrapper` — a component that
// wraps every page, reads the resolved `theme`/`themes` config + the theme
// cookie, and applies the active theme's CSS variables (plus the runtime picker).
//
// Installing this is all the app does for themes: `extends: [vikeReactThemes]` +
// a `theme: '<name>'` sibling key. No ThemeProvider wiring in the app.
export default {
  name: 'vike-react-themes',
  extends: ['import:vike-themes/config:default'],
  Wrapper: 'import:vike-react-themes/ThemeWrapper:default',
}
