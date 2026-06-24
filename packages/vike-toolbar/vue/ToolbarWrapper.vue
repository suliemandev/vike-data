<script setup>
import { usePageContext } from 'vike-vue/usePageContext'
import { allToolbarItems } from '../index.js'
import Toolbar from './Toolbar.vue'

const pageContext = usePageContext()
const items = allToolbarItems(pageContext.config?.toolbarItems)
</script>
<template>
  <slot />
  <Toolbar :items="items" />
</template>
