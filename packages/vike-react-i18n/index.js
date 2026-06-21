// React binding for vike-i18n. Re-exports the core helpers too, so a component
// author needs a single import for both the hook and defineMessages.
export { LocaleProvider, useTranslation } from './LocaleProvider.jsx'
export { defineMessages, mergeMessages, translate, availableLocales } from 'vike-i18n'
