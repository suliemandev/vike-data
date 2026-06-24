export default {
  name: 'vike-admin-vue',
  extends: ['import:vike-admin/config:default'],
  pages: [
    {
      route: '/admin',
      Page: 'import:vike-admin/vue/DashboardPage:default',
      guard: 'import:vike-admin/guard:adminGuard',
      data: 'import:vike-admin/data:dashboardData',
    },
    {
      route: '/admin/@table',
      Page: 'import:vike-admin/vue/ListPage:default',
      guard: 'import:vike-admin/guard:adminGuard',
      data: 'import:vike-admin/data:listData',
    },
    {
      route: '/admin/@table/new',
      Page: 'import:vike-admin/vue/NewPage:default',
      guard: 'import:vike-admin/guard:adminGuard',
      data: 'import:vike-admin/data:newData',
    },
    {
      route: '/admin/@table/@id',
      Page: 'import:vike-admin/vue/EditPage:default',
      guard: 'import:vike-admin/guard:adminGuard',
      data: 'import:vike-admin/data:editData',
    },
  ],
}
