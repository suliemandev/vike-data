import vike from 'vike/plugin'
import vue from '@vitejs/plugin-vue'
import vikeI18n from 'vike-i18n/plugin'
import vikeRbacTelefunc from 'vike-rbac/telefunc-plugin'
import telefunc from 'telefunc/vite'

export default {
  plugins: [vike(), vue(), vikeI18n(), vikeRbacTelefunc(), telefunc()],
  optimizeDeps: {
    exclude: ['vike-admin', 'vike-auth', 'vike-themes', 'vike-layouts', 'vike-toolbar', 'vike-i18n', 'vike-theme-emerald', 'vike-push'],
  },
  server: { port: 4200, strictPort: true },
}
