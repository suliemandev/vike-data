<script setup>
// Active item (#303): the link matching the current page renders full-contrast +
// bold with aria-current="page"; the rest stay muted. The MATCH is the
// framework-agnostic isActivePath from the core (shared with the React NavList);
// only the styling is per-framework. The current path comes from vike-vue's
// pageContext, so it tracks the server render and every client-side navigation.
import { usePageContext } from 'vike-vue/usePageContext'
import { isActivePath } from '../../index.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
  vertical: { type: Boolean, default: false },
})

const pageContext = usePageContext()
const isActive = (href) => isActivePath(pageContext.urlPathname || '', href)
</script>
<template>
  <nav :style="{ display: 'flex', flexDirection: props.vertical ? 'column' : 'row', gap: 'var(--space-md, 1rem)' }">
    <a
      v-for="item in props.items"
      :key="item.href ?? item.label"
      :href="item.href"
      :aria-current="isActive(item.href) ? 'page' : undefined"
      :style="{
        color: isActive(item.href) ? 'var(--color-text)' : 'var(--color-muted)',
        fontWeight: isActive(item.href) ? 600 : 400,
        textDecoration: 'none',
        fontSize: '14px',
      }"
    >{{ item.label }}</a>
  </nav>
</template>
