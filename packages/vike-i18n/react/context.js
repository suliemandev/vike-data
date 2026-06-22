// Pure-JS context + hook (no JSX), so the config entry can expose useTranslation
// at vike-i18n/react/hooks without forcing Node to load a .jsx file when Vike
// resolves the config. The JSX (the LocaleProvider, the Wrapper, the picker)
// stays in .jsx files that only Vite loads, via the pointer-imports in the config.
import { createContext, useContext } from 'react'
import { translate } from '../index.js'

export const I18nCtx = createContext(null)

// The i18n runtime is OPTIONAL. A UI extension ships English INLINE and passes its
// own English catalog (a `{ key: string }` map) as `fallback`; the component then
// renders standalone with NO provider installed. When the provider IS present, its
// merged dictionary (active locale, with other contributions composed in) wins, and
// the inline English fills any gap — including locale 'en', for which an extension
// contributes nothing cumulatively (English is never in `messages`, only inline).
// So `useTranslation()` never throws for a missing provider; i18n is pure opt-in.
export function useTranslation(fallback = {}) {
  const ctx = useContext(I18nCtx)
  if (!ctx) {
    return { t: (key, vars) => translate(fallback, key, vars), locale: 'en', locales: ['en'], setLocale: () => {} }
  }
  const dict = { ...fallback, ...(ctx.dict || {}) } // provider (active locale) over inline English
  return { ...ctx, t: (key, vars) => translate(dict, key, vars) }
}
