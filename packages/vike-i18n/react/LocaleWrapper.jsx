// The vike-react Wrapper contributed by vike-i18n/react. Turns the declarative
// messages config into a running LocaleProvider: the composed `messages`
// (cumulative, from every extension + the app) are the dictionary, and the active
// locale is pageContext.locale (Vike's locale routing) -> the vike_locale cookie
// -> the configured `locale` default.
//
// The dictionary has TWO sources, both in the `messages` shape so mergeMessages
// composes them uniformly:
//   - config.messages : explicit cumulative contributions (the app's own strings,
//                        and any pack still wired the manual `extends` way).
//   - the AUTO packs   : the language catalogs the vike-i18n Vite plugin pulled in
//                        from the `localePacks` registry for the app's `locales`
//                        (#79). Imported from the virtual module so Vite bundles
//                        only the locales in `locales` (per-locale tree-shaking). The
//                        plugin always provides this module (empty `packs` when no
//                        registry/lang), so the static import never fails to
//                        resolve as long as vikeI18n() is in the app's vite config.
import { usePageContext } from 'vike-react/usePageContext'
import { packs as autoPacks } from 'virtual:vike-i18n/packs'
import { availableLocales } from '../index.js'
import { LocaleProvider } from './LocaleProvider.jsx'
import { LocalePicker } from './LocalePicker.jsx'

export default function LocaleWrapper({ children }) {
  const pageContext = usePageContext()
  const config = pageContext.config || {}
  // Auto-included packs first, explicit config.messages last (app overrides win,
  // matching mergeMessages' "later contribution wins" rule).
  const messages = [...autoPacks, ...(config.messages || [])]
  const locales = availableLocales(messages)
  const locale = pageContext.locale || pageContext.localeCookie || config.locale || 'en'

  return (
    <LocaleProvider messages={messages} locale={locale} locales={locales}>
      {children}
      <LocalePicker />
    </LocaleProvider>
  )
}
