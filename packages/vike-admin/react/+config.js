// The React binding for vike-admin, a SUBPATH of the one package (no separate React
// package) — the same core/UI split as every extension. The default export is the Vike
// config, so the app does `import admin from 'vike-admin/react'; extends: [admin]` and
// gets the seam + the /admin/* pages in one install.
//
// It self-installs the core (vike-admin/config) and SHIPS its own pages via config.pages
// (vike#3356): install this and the admin panel appears, with no page file in the app.
// Each page wires three server hooks by pointer-import string:
//   - guard: the signed-in fence (redirects anon -> /login),
//   - data:  the per-page server hook (resolve schema + read/write through universal-orm).
// The Page components only render the view-model the data hook returns.
//
// Config-ONLY on purpose (Vike loads this in plain Node to resolve config): the JSX
// pages and the hook functions are referenced by pointer-import strings, loaded by Vite.
// The admin pages use the app's default layout/theme; nothing UI-specific is hardcoded.
export default {
  name: 'vike-admin-react',
  extends: ['import:vike-admin/config:default'],
  pages: [
    {
      route: '/admin',
      Page: 'import:vike-admin/react/DashboardPage:default',
      guard: 'import:vike-admin/guard:adminGuard',
      data: 'import:vike-admin/data:dashboardData',
    },
    {
      route: '/admin/@table',
      Page: 'import:vike-admin/react/ListPage:default',
      guard: 'import:vike-admin/guard:adminGuard',
      data: 'import:vike-admin/data:listData',
    },
    {
      route: '/admin/@table/new',
      Page: 'import:vike-admin/react/NewPage:default',
      guard: 'import:vike-admin/guard:adminGuard',
      data: 'import:vike-admin/data:newData',
    },
    {
      // `/admin/@table/new` (static segment) keeps precedence over this `@id` param, so
      // creating never resolves to editing a row whose id is literally "new".
      route: '/admin/@table/@id',
      Page: 'import:vike-admin/react/EditPage:default',
      guard: 'import:vike-admin/guard:adminGuard',
      data: 'import:vike-admin/data:editData',
    },
  ],
}
