import { inject } from 'vue'
import { translate } from '../index.js'

export const I18N_KEY = Symbol('vike-i18n')

// The i18n runtime is OPTIONAL. A UI extension ships English INLINE and passes its
// own English catalog as `fallback`; the component then renders standalone with NO
// provider installed. When the provider IS present, its merged dictionary wins, and
// the inline English fills any gap. So useTranslation() never throws for a missing
// provider; i18n is pure opt-in.
export function useTranslation(fallback = {}) {
  const ctx = inject(I18N_KEY, null)
  if (!ctx) {
    return { t: (key, vars) => translate(fallback, key, vars), locale: 'en', locales: ['en'], setLocale: () => {} }
  }
  const dict = { ...fallback, ...(ctx.dict?.value || ctx.dict || {}) }
  return { ...ctx, t: (key, vars) => translate(dict, key, vars) }
}
