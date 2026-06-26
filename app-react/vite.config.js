import vike from 'vike/plugin'
import vikeI18n from 'vike-i18n/plugin'
import telefunc from 'telefunc/vite'
import { loadEnv } from 'vite'

export default ({ mode }) => {
  // Surface the demo's optional transport secrets (Resend / VAPID, see .env.example) from a
  // local .env file into process.env, so +onCreateGlobalContext.js (the server hook) and
  // +config.js can read them. Vite otherwise only exposes VITE_-prefixed vars, to
  // import.meta.env. Real env vars already set in the environment take precedence and work
  // in production too. Unset = the demo's dev console/outbox transports, unchanged.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ['RESEND_', 'VAPID_']))
  return {
    // vikeI18n() reads the app's `locales` + every extension's advertised `localePacks`
    // and provides the virtual:vike-i18n/packs module that bundles only the matching
    // locales (#79). It must come after vike() so getVikeConfig() sees a resolved
    // config.
    // telefunc() transforms the app's *.telefunc.js files (server functions called from
    // the browser). vike-rbac's Telefunc seam (#110) puts the signed-in, role-enriched user
    // on the RPC context through ONE universal middleware for dev AND prod — wired in
    // pages/+config.js (`middleware` + `client`), not here. It relocates telefunc's endpoint
    // off the default `/_telefunc` so telefunc's own context-less dev middleware never
    // intercepts the RPC (#128) — no dev-only Vite plugin needed.
    plugins: [vike(), vikeI18n(), telefunc()],
    // vike-react renders with the automatic JSX runtime (imports react/jsx-runtime),
    // so no `import React` is needed in components. Applies to app + workspace .jsx.
    esbuild: { jsx: 'automatic' },
    // The workspace UI packages are plain .jsx source (incl. the pointer-imported
    // Wrapper/Layout components Vike pulls in); serve them as source instead of
    // pre-bundling, so esbuild's automatic-JSX transform applies uniformly.
    optimizeDeps: {
      exclude: ['vike-admin', 'vike-auth', 'vike-themes', 'vike-layouts', 'vike-toolbar', 'vike-i18n', 'vike-theme-emerald', 'vike-push', 'vike-storage'],
    },
    server: { port: 4100, strictPort: true },
  }
}
