<script setup>
import { computed } from 'vue'
import { usePageContext } from 'vike-vue/usePageContext'
import ThemeProvider from './ThemeProvider.vue'
import ThemePicker from './ThemePicker.vue'

const pageContext = usePageContext()
const config = computed(() => pageContext.config || {})

const themes = computed(() => {
  let list = (config.value.themes || []).flat()
  const t = config.value.theme
  if (t && typeof t === 'object' && t.name && !list.some((x) => x.name === t.name)) {
    list = [...list, t]
  }
  return Object.fromEntries(list.map((x) => [x.name, x]))
})

const themeName = computed(() => {
  const t = config.value.theme
  return pageContext.themeCookie || (typeof t === 'string' ? t : t?.name) || 'default'
})

const appearance = computed(() =>
  pageContext.appearanceCookie || config.value.appearance || 'system'
)

const hasThemes = computed(() => Object.keys(themes.value).length > 0)
</script>
<template>
  <slot v-if="!hasThemes" />
  <ThemeProvider v-else :themes="themes" :theme="themeName" :appearance="appearance">
    <slot />
    <ThemePicker />
  </ThemeProvider>
</template>
