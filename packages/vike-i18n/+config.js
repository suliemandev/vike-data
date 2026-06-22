// The config SEAM for localization — install + configure like every other
// extension. vike-i18n declares the contribution points (framework-agnostic):
//   - `locale`   : the active locale by name. A single, page-overridable selection
//                  the app sets a default for. The React binding prefers
//                  pageContext.locale (Vike's locale routing) when it is set, so a
//                  future onBeforeRoute integration just works.
//   - `messages` : the translations. CUMULATIVE, so extensions register their own
//                  strings (like `schemas` compose) and the app composes/overrides.
//
// The React rendering (the t() hook, the locale picker) is the binding's job
// (the vike-i18n/react subpath) — same core/UI split as the rest. Here we declare
// the seam and read the locale cookie.
export default {
  name: 'vike-i18n',
  meta: {
    locale: { env: { config: true, server: true, client: true } },
    messages: { env: { config: true, server: true, client: true }, cumulative: true },
  },
  locale: 'en',
  messages: [],
  onCreatePageContext: 'import:vike-i18n/oncreate:default',
  passToClient: ['localeCookie'],
}
