import { inject } from 'vue'

export const THEME_KEY = Symbol('vike-theme')

export function useTheme() {
  const ctx = inject(THEME_KEY)
  if (!ctx) throw new Error('[vike-themes/vue] useTheme must be used inside the theme Wrapper')
  return ctx
}
