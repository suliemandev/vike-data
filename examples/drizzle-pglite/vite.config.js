import vike from 'vike/plugin'
import vikeI18n from 'vike-i18n/plugin'
import vikeSchema from '@vike-data/vike-schema/plugin'

export default {
  // vikeSchema() reads Vike's merged `schemas` (every installed extension's tables: vike-auth's
  // users/sessions/login_tokens, vike-rbac's roles/permissions/role_user/permission_role) and
  // writes the declarative Drizzle schema to drizzle/schema.generated.ts on dev-server start and
  // on build. It must come AFTER vike() so getVikeConfig() sees a resolved config. This is the
  // ONE plugin examples/react does not have: the memory adapter is schema-less, so it never needs
  // generated DDL; a real database does. drizzle-kit then derives the SQL migrations from this file
  // (pnpm db:generate), the standard Drizzle workflow.
  // vikeI18n() provides the virtual:vike-i18n/packs module vike-auth's React components read
  // (English ships inline as the fallback). It must come after vike().
  plugins: [vike(), vikeI18n(), vikeSchema()],
  esbuild: { jsx: 'automatic' },
  optimizeDeps: {
    exclude: ['vike-admin', 'vike-auth', 'vike-themes', 'vike-layouts', 'vike-theme-emerald', 'vike-i18n'],
  },
  // pglite ships a wasm Postgres; keep it (and drizzle) out of Vite's dep optimizer and as a
  // server-side external so the wasm/node bits are never pulled into the client bundle.
  ssr: { external: ['@electric-sql/pglite', 'drizzle-orm'] },
  server: { port: 4200, strictPort: true },
}
