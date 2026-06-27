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
    exclude: ['vike-auth', 'vike-layouts', 'vike-storage', 'vike-themes', 'vike-theme-emerald'],
  },
  // Distinct from app-react (4100), app-vue (4200) and two-audience (4300) so the
  // demos can run side by side.
  server: { port: 4400, strictPort: true },
}
