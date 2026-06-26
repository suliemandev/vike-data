import vike from 'vike/plugin'
import vue from '@vitejs/plugin-vue'
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
    // vike-rbac's Telefunc seam (#110/#128) is wired in pages/+config.js (`middleware` +
    // `client`), one universal middleware for dev AND prod; no dev-only Vite plugin.
    plugins: [vike(), vue(), vikeI18n(), telefunc()],
    optimizeDeps: {
      exclude: ['vike-admin', 'vike-auth', 'vike-themes', 'vike-layouts', 'vike-toolbar', 'vike-i18n', 'vike-theme-emerald', 'vike-push'],
    },
    server: { port: 4200, strictPort: true },
  }
}
