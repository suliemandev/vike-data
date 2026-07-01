import vike from 'vike/plugin'

export default {
  plugins: [vike()],
  // vike-react uses the automatic JSX runtime, so no `import React` in components.
  esbuild: { jsx: 'automatic' },
  // vike-blocks ships plain .jsx source; serve it as source so the JSX transform applies.
  optimizeDeps: { exclude: ['vike-blocks'] },
  // Share ONE React instance between the app and vike-blocks' components (workspace packages
  // resolve react from their own node_modules); otherwise SSR throws on cross-copy elements.
  resolve: { dedupe: ['react', 'react-dom', 'react/jsx-runtime'] },
  server: { port: 4300, strictPort: true },
}
