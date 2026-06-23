// The React binding config for vike-i18n, as a SUBPATH of the one package (no
// separate vike-react-i18n). The default export is the Vike config, so the app
// does `import i18n from 'vike-i18n/react'; extends: [i18n]` (no /config).
//
// It self-installs the framework-agnostic core (vike-i18n/config) and contributes
// a vike-react `Wrapper` that provides t() + the locale picker to every page.
// Installing this is all the app does for i18n; extensions contribute their
// strings through the cumulative `messages` config.
//
// It also drives vike-react's `lang` (<html lang>) and `htmlAttributes` (<html dir>)
// off the active locale, so the document declares its language and flips to RTL for
// Arabic/Hebrew/etc. with no app wiring (#54). Both are pointer-imported functions
// (vike-react resolves them server-side per page); the live client-side flip is in
// LocaleProvider.
//
// Config-ONLY on purpose: Vike loads this in plain Node to resolve the config, so
// it imports no .jsx and re-exports nothing. The JSX (Wrapper/provider/picker) is
// referenced via the pointer-import below and loaded by Vite. The t() hook lives
// at `vike-i18n/react/hooks` (pure JS).
export default {
  name: 'vike-i18n-react',
  extends: ['import:vike-i18n/config:default'],
  Wrapper: 'import:vike-i18n/react/LocaleWrapper:default',
  lang: 'import:vike-i18n/react/html:lang',
  htmlAttributes: 'import:vike-i18n/react/html:htmlAttributes',
}
