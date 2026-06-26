// The React binding config for vike-toolbar, as a SUBPATH of the one package (no
// separate vike-react-toolbar). The default export is the Vike config, so the app does
// `import toolbar from 'vike-toolbar/react'; extends: [toolbar]` (no /config).
//
// It self-installs the framework-agnostic core (vike-toolbar/config, which declares the
// cumulative `toolbarItems` seam) and contributes a vike-react `Wrapper` (cumulative)
// that renders the fixed logo button + popover around every page — the same overlay
// mechanism vike-themes uses for its picker. So a page just installs the extension and
// the toolbar appears; extensions fill it by advertising `toolbarItems`.
//
// Config-ONLY on purpose: Vike loads this in plain Node to resolve config, so it imports
// no .jsx. The Wrapper (and the Toolbar it renders) are referenced by the pointer-import
// and loaded by Vite.
export default {
  name: 'vike-toolbar-react',
  extends: ['import:vike-toolbar/config:default'],
  Wrapper: 'import:vike-toolbar/react/ToolbarWrapper:default',
}
