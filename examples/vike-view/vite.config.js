import vike from 'vike/plugin'

export default {
  plugins: [vike()],
  // vike-react renders with the automatic JSX runtime (imports react/jsx-runtime), so no
  // `import React` is needed in components. Applies to the app's + workspace .jsx.
  esbuild: { jsx: 'automatic' },
  // vike-view / vike-blocks ship plain .jsx source (incl. the pointer-imported ViewPage Vike
  // pulls in); serve them as source instead of pre-bundling so the automatic-JSX transform applies.
  optimizeDeps: {
    exclude: ['vike-view', 'vike-blocks'],
  },
  // The workspace UI packages resolve react from their own node_modules; dedupe so the app and
  // vike-view's <ListView> share ONE React instance (otherwise SSR throws "Objects are not valid
  // as a React child" when an element created by one copy is rendered by the other).
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: { port: 4200, strictPort: true },
}
