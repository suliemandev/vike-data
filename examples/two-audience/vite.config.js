import vike from 'vike/plugin'

export default {
  plugins: [vike()],
  // vike-react renders with the automatic JSX runtime (imports react/jsx-runtime),
  // so no `import React` is needed in components. Applies to app + workspace .jsx.
  esbuild: { jsx: 'automatic' },
  // The workspace UI packages are plain .jsx source (incl. the pointer-imported
  // Wrapper/Layout components Vike pulls in); serve them as source instead of
  // pre-bundling, so esbuild's automatic-JSX transform applies uniformly.
  optimizeDeps: {
    exclude: ['vike-auth', 'vike-layouts', 'vike-themes', 'vike-theme-emerald'],
  },
  // Distinct from app-react (4100) and app-vue (4200) so the three demos can run
  // side by side.
  server: { port: 4300, strictPort: true },
}
