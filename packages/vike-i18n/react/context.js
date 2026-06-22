// Pure-JS context + hook (no JSX), so the config entry can expose useTranslation
// at vike-i18n/react/hooks without forcing Node to load a .jsx file when Vike
// resolves the config. The JSX (the LocaleProvider, the Wrapper, the picker)
// stays in .jsx files that only Vite loads, via the pointer-imports in the config.
import { createContext, useContext } from 'react'

export const I18nCtx = createContext(null)

export function useTranslation() {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('[vike-i18n/react] useTranslation must be used inside the i18n Wrapper')
  return ctx
}
