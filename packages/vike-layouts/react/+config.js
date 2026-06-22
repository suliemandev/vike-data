// The React binding config for vike-layouts, as a SUBPATH of the one package (no
// separate vike-react-layouts). The default export is the Vike config, so the app
// does `import layouts from 'vike-layouts/react'; extends: [layouts]` (no /config).
//
// It self-installs the framework-agnostic core (vike-layouts/config) and
// contributes a vike-react `Layout` (cumulative) that reads the resolved
// `layout`/`logo`/`nav` config and renders the matching shell around the page —
// so a page just sets `layout: 'topbar'` and gets the shell, no <Layout> wrapper.
//
// Config-ONLY on purpose: Vike loads this in plain Node to resolve the config, so
// it imports no .jsx and re-exports nothing. The shells (ConfigLayout/Layout and
// the shell components) are referenced via the pointer-import below and loaded by
// Vite.
export default {
  name: 'vike-layouts-react',
  extends: ['import:vike-layouts/config:default'],
  Layout: 'import:vike-layouts/react/ConfigLayout:default',
}
