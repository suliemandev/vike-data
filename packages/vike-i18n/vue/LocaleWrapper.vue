<script setup>
import { computed } from 'vue'
import { usePageContext } from 'vike-vue/usePageContext'
import { packs as autoPacks } from 'virtual:vike-i18n/packs'
import { availableLocales, activeLocale } from '../index.js'
import LocaleProvider from './LocaleProvider.vue'
import LocalePicker from './LocalePicker.vue'

const pageContext = usePageContext()
const config = computed(() => pageContext.config || {})
const messages = computed(() => [...autoPacks, ...(config.value.messages || [])])
const locales = computed(() => availableLocales(messages.value))
const locale = computed(() => activeLocale(pageContext))
</script>
<template>
  <LocaleProvider :messages="messages" :locale="locale" :locales="locales">
    <slot />
    <LocalePicker />
  </LocaleProvider>
</template>
