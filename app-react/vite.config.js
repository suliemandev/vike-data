import vike from 'vike/plugin'

export default {
  plugins: [vike()],
  // vike-react renders with the automatic JSX runtime (imports react/jsx-runtime),
  // so no `import React` is needed in components. Applies to app + workspace .jsx.
  esbuild: { jsx: 'automatic' },
  server: { port: 4100, strictPort: true },
}
