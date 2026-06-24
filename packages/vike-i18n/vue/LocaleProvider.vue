<script setup>
import { ref, computed, provide, watch } from 'vue'
import { mergeMessages, translate, localeDir } from '../index.js'
import { I18N_KEY } from './context.js'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  locale: { type: String, default: 'en' },
  locales: { type: Array, default: () => ['en'] },
})

function writeCookie(name, value) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
}

const locale = ref(props.locales.includes(props.locale) ? props.locale : props.locales[0] || 'en')
const dict = computed(() => mergeMessages(props.messages, locale.value))
const t = (key, vars) => translate(dict.value, key, vars)

function setLocale(next) {
  if (!props.locales.includes(next)) return
  locale.value = next
  writeCookie('vike_locale', next)
}

watch(locale, (l) => {
  if (typeof document === 'undefined') return
  document.documentElement.lang = l
  document.documentElement.dir = localeDir(l)
})

provide(I18N_KEY, { locale, locales: computed(() => props.locales), setLocale, t, dict })
</script>
<template>
  <slot />
</template>
