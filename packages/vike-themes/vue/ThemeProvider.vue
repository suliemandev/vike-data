<script setup>
import { h, ref, computed, provide } from 'vue'
import { themeToAppearanceCss, baseCss, presets, APPEARANCES } from '../index.js'
import { THEME_KEY } from './context.js'

const props = defineProps({
  themes: { type: Object, default: () => presets },
  theme: { type: String, default: 'default' },
  appearance: { type: String, default: 'system' },
})

const names = computed(() => Object.keys(props.themes))
const themeName = ref(props.themes[props.theme] ? props.theme : names.value[0])
const appearance = ref(APPEARANCES.includes(props.appearance) ? props.appearance : 'system')
const theme = computed(() => props.themes[themeName.value])

const css = computed(() =>
  `${themeToAppearanceCss(theme.value, appearance.value, ':root')}\n${baseCss}`
)

// The whole theme contract: the active brand's variables for the active appearance
// (system -> light + a prefers-color-scheme dark media rule), plus the minimal
// base/reset authored against those variables. Built with h() using `innerHTML`
// (Vue's SSR-safe equivalent of React's dangerouslySetInnerHTML) — `v-html` on a
// dynamic `<component :is="'style'">` does NOT serialize its content during SSR, so
// the <style> tag would render empty and the page would be unthemed on first paint.
const styleEl = computed(() =>
  h('style', {
    'data-vike-theme': themeName.value,
    'data-vike-appearance': appearance.value,
    innerHTML: css.value,
  }),
)

function writeCookie(name, value) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
}

function setTheme(next) {
  if (!props.themes[next]) return
  themeName.value = next
  writeCookie('vike_theme', next)
}

function setAppearance(next) {
  if (!APPEARANCES.includes(next)) return
  appearance.value = next
  writeCookie('vike_appearance', next)
}

provide(THEME_KEY, {
  theme,
  themeName,
  themes: computed(() => props.themes),
  names,
  setTheme,
  appearance,
  appearances: APPEARANCES,
  setAppearance,
})
</script>
<template>
  <component :is="styleEl" />
  <slot />
</template>
