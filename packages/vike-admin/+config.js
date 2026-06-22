// vike-admin CORE — the framework-agnostic seam. It opens ONE contribution point,
// a cumulative `adminResources` config, exactly like vike-schema opens `schemas` and
// vike-themes opens `themes`. Every extension (and the app) contributes resources to
// it; vike-admin renders their union. There is no central `.resources([...])` registry
// to keep in sync — resources compose the same way tables and themes do.
//
// `adminResources` is SERVER-env config (not client): the admin is SSR + form POSTs,
// so a resource's functions (canView / canEdit predicates, builders) live as real
// server functions and nothing has to serialize to the client. The data hooks derive a
// plain, serializable view-model from them per request.
//
// It self-installs vike-schema (its `extends`) so the cumulative `schemas` point — the
// merged schema the admin introspects and reads/writes through universal-orm — is
// always present. The UI + the /admin/* pages live in the `vike-admin/react` subpath
// (config.pages), the same core/UI split as every extension.
export default {
  name: 'vike-admin',
  extends: ['import:@vike-data/vike-schema/config:default'],
  meta: {
    adminResources: {
      // server-ONLY: resources carry functions (canView/canEdit, builders), so the value
      // must be delivered to the server hooks via pointer-import, never serialized. Adding
      // `config: true` would force config-time JSON serialization and drop the functions to
      // `undefined`. The admin is read only in server hooks (data/guard), so server suffices.
      env: { server: true },
      cumulative: true,
    },
  },
  adminResources: [],
}
