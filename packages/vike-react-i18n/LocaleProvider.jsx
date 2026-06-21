// vike-react-i18n — the React binding over vike-i18n. Holds the active locale,
// merges the composed messages for it, and exposes a t() function. Switching the
// locale re-merges client-side (instant) and persists to a cookie. SSR-safe: the
// provider is initialized from the locale a page resolves off pageContext.
import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { mergeMessages, translate } from 'vike-i18n'

const I18nCtx = createContext(null)

const writeCookie = (name, value) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function LocaleProvider({ messages = [], locale: initialLocale = 'en', locales = ['en'], children }) {
  const [locale, setLoc] = useState(locales.includes(initialLocale) ? initialLocale : locales[0] || 'en')
  const dict = useMemo(() => mergeMessages(messages, locale), [messages, locale])
  const t = useCallback((key, vars) => translate(dict, key, vars), [dict])

  const setLocale = useCallback(
    (next) => {
      if (!locales.includes(next)) return
      setLoc(next)
      writeCookie('vike_locale', next)
    },
    [locales],
  )

  const value = useMemo(() => ({ locale, locales, setLocale, t }), [locale, locales, setLocale, t])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('[vike-react-i18n] useTranslation must be used inside <LocaleProvider>')
  return ctx
}
