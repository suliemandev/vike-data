// The vike-react Wrapper contributed by vike-i18n/react. Turns the declarative
// messages config into a running LocaleProvider: the composed `messages`
// (cumulative, from every extension + the app) are the dictionary, and the active
// locale is pageContext.locale (Vike's locale routing) -> the vike_locale cookie
// -> the configured `locale` default.
import { usePageContext } from 'vike-react/usePageContext'
import { availableLocales } from '../index.js'
import { LocaleProvider } from './LocaleProvider.jsx'
import { LocalePicker } from './LocalePicker.jsx'

export default function LocaleWrapper({ children }) {
  const pageContext = usePageContext()
  const config = pageContext.config || {}
  const messages = config.messages || []
  const locales = availableLocales(messages)
  const locale = pageContext.locale || pageContext.localeCookie || config.locale || 'en'

  return (
    <LocaleProvider messages={messages} locale={locale} locales={locales}>
      {children}
      <LocalePicker />
    </LocaleProvider>
  )
}
