import vike from 'vike/plugin'
import vikeSchema from '@vike-data/vike-schema/plugin'

export default {
  // vikeSchema reads Vike's resolved config graph (the merged `schemas` from
  // every installed extension) and writes the per-ORM artifacts on build + dev
  // start. It replaces the old app-owned generate.mjs stand-in.
  plugins: [vike(), vikeSchema()],
  server: { port: 4000, strictPort: true },
  // The Rudder runtime driver (`@rudderjs/database` + its native `better-sqlite3`) is
  // node-only — it must never enter the client bundle. The +onCreateGlobalContext hook
  // (server-only) references it for VIKE_DATA_ORM=rudder, so mark it external in BOTH builds:
  // the server resolves it at runtime, and the client tree-shakes the unused server import
  // instead of trying to bundle AsyncLocalStorage / a .node addon for the browser.
  build: { rollupOptions: { external: [/^@rudderjs\/database/, 'better-sqlite3'] } },
  ssr: { external: ['@rudderjs/database', 'better-sqlite3'] },
}
