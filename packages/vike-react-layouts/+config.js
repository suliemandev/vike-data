// The React binding for vike-layouts. Self-installs the core config and
// contributes a vike-react `Layout` (cumulative) that reads the resolved
// `layout`/`logo`/`nav` config and renders the matching shell around the page.
//
// Installing this + setting `layout: '<name>'` is all the app does — no shell
// wiring in the page components.
export default {
  name: 'vike-react-layouts',
  extends: ['import:vike-layouts/config:default'],
  Layout: 'import:vike-react-layouts/ConfigLayout:default',
}
