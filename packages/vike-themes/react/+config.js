// The React binding config for vike-themes, as a SUBPATH of the one package (no
// separate vike-react-themes). The default export is the Vike config, so the app
// does `import themes from 'vike-themes/react'; extends: [themes]` (no /config).
//
// Config-ONLY on purpose: Vike loads this in plain Node to resolve the config, so
// it imports no .jsx and re-exports nothing. The JSX (Wrapper/provider/picker) is
// referenced via the pointer-import below and loaded by Vite. The hook lives at
// `vike-themes/react/hooks` (pure JS).
export default {
  name: 'vike-themes-react',
  extends: ['import:vike-themes/config:default'],
  Wrapper: 'import:vike-themes/react/ThemeWrapper:default',
}
