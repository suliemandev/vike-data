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
//
// Two more contribution points enable the ZERO-CONFIG `locales: [...]` auto-include
// (#79): the app declares its languages ONCE and every installed extension's
// matching language pack lights up, with no per-pack import/extends.
//   - `locales`     : the app's languages (e.g. ['en','fr','ar']). A single value
//                     the app sets; the Vite plugin reads it. (Named `locales`, the
//                     plural of the active-locale `locale`, to avoid colliding with
//                     vike-react's built-in `lang` config, which owns <html lang>.)
//   - `localePacks` : the registry. CUMULATIVE — each extension advertises a
//                     `{ <locale>: <module specifier> }` map of its catalogs (plain
//                     DATA strings, so it composes like `messages`/`schemas` with no
//                     pointer-import resolution). The vike-i18n Vite plugin
//                     (vike-i18n/plugin) turns `locales` + this registry into a virtual
//                     module that STATICALLY imports only the matching-locale
//                     catalogs — so Vite still tree-shakes per locale, and Vike
//                     never has to resolve a config-value-driven `extends`.
export default {
  name: 'vike-i18n',
  meta: {
    locale: { env: { config: true, server: true, client: true } },
    messages: { env: { config: true, server: true, client: true }, cumulative: true },
    locales: { env: { config: true, server: true, client: true } },
    localePacks: { env: { config: true }, cumulative: true },
  },
  locale: 'en',
  messages: [],
  locales: ['en'],
  localePacks: [],
  onCreatePageContext: 'import:vike-i18n/oncreate:default',
  passToClient: ['localeCookie'],
}
