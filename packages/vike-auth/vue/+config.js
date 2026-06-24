export default {
  name: 'vike-auth-vue',
  extends: ['import:vike-auth/config:default', 'import:vike-i18n/config:default'],
  localePacks: [{ fr: 'vike-auth/fr/messages', ar: 'vike-auth/ar/messages' }],
  meta: {
    loginRedirect: { env: { config: true, server: true, client: true } },
    onCreatePageContext: { env: { server: true } },
  },
  loginRedirect: '/',
  pages: [
    {
      route: '/login',
      Page: 'import:vike-auth/vue/LoginPage:default',
      guard: 'import:vike-auth/vue/loginGuard:guard',
      layout: 'centered',
    },
    { route: '/account', Page: 'import:vike-auth/vue/AccountPage:default' },
  ],
}
