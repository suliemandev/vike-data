// The <html lang> + <html dir> drivers, contributed to vike-react by the
// vike-i18n/react config. Both derive from the ACTIVE locale (the cookie / Vike
// routing / the app default), so the document announces its language to assistive
// tech and search engines AND flips to RTL for Arabic/Hebrew/etc. with no app
// wiring (#54). Every layout shell inherits the <html> direction, so the whole
// page (content, pickers, native form controls, scrollbar side) flips together.
//
// Pure JS (no JSX): Vike loads the config in plain Node and calls these
// server-side with the page's pageContext. The live client-side flip (when the
// locale picker switches without a navigation) is handled in LocaleProvider.
import { activeLocale, localeDir } from '../index.js'

/** vike-react `lang` driver: <html lang> = the active locale (overrides the default). */
export function lang(pageContext) {
  return activeLocale(pageContext)
}

/** vike-react `htmlAttributes` driver: <html dir> = the active locale's direction. */
export function htmlAttributes(pageContext) {
  return { dir: localeDir(activeLocale(pageContext)) }
}
