// The React binding for vike-i18n. Self-installs the core config and contributes
// a vike-react Wrapper that provides t() + the locale picker to every page.
// Installing this is all the app does for i18n; extensions contribute their
// strings through the cumulative `messages` config.
export default {
  name: 'vike-react-i18n',
  extends: ['import:vike-i18n/config:default'],
  Wrapper: 'import:vike-react-i18n/LocaleWrapper:default',
}
