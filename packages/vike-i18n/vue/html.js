import { activeLocale, localeDir } from '../index.js'

export function lang(pageContext) {
  return activeLocale(pageContext)
}

export function htmlAttributes(pageContext) {
  return { dir: localeDir(activeLocale(pageContext)) }
}
