import vike from 'vike/plugin'

export default {
  plugins: [vike()],
  optimizeDeps: {
    // DocPress needs its search dep pre-bundled (mirrors the DocPress demo).
    include: ['@docsearch/react'],
    // Workspace UI packages ship ESM source (.js/.jsx); keep them out of the
    // pre-bundle so HMR + workspace symlinks resolve (same as the other examples).
    exclude: ['vike-themes', 'vike-theme-emerald'],
  },
}
