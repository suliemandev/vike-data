<script setup>
import { computed } from 'vue'
import { usePageContext } from 'vike-vue/usePageContext'
import { defineLayout } from '../index.js'
import CenteredShell from './shells/CenteredShell.vue'
import TopbarShell from './shells/TopbarShell.vue'
import SidebarShell from './shells/SidebarShell.vue'

const SHELLS = { centered: CenteredShell, topbar: TopbarShell, sidebar: SidebarShell }

const pageContext = usePageContext()
const resolved = computed(() => {
  const config = pageContext.config || {}
  return defineLayout({
    shell: config.layout,
    logo: config.logo,
    nav: (config.nav || []).flat(),
  })
})
const Shell = computed(() => SHELLS[resolved.value.shell] || CenteredShell)
</script>
<template>
  <component :is="Shell" :layout="resolved">
    <slot />
  </component>
</template>
