import vike from 'vike/plugin'
import vikeI18n from 'vike-i18n/plugin'

export default {
  // vikeI18n() reads the app's `lang` + every extension's advertised `localePacks`
  // and provides the virtual:vike-i18n/packs module that bundles only the matching
  // locales (#79). It must come after vike() so getVikeConfig() sees a resolved
  // config.
  plugins: [vike(), vikeI18n()],
  // vike-react renders with the automatic JSX runtime (imports react/jsx-runtime),
  // so no `import React` is needed in components. Applies to app + workspace .jsx.
  esbuild: { jsx: 'automatic' },
  // The workspace UI packages are plain .jsx source (incl. the pointer-imported
  // Wrapper/Layout components Vike pulls in); serve them as source instead of
  // pre-bundling, so esbuild's automatic-JSX transform applies uniformly.
  optimizeDeps: {
    exclude: ['vike-admin', 'vike-auth', 'vike-themes', 'vike-layouts', 'vike-i18n', 'vike-theme-emerald'],
  },
  server: { port: 4100, strictPort: true },
}
