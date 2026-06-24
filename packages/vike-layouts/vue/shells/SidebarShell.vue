<script setup>
import NavList from './NavList.vue'
const props = defineProps({
  layout: { type: Object, default: () => ({ dir: 'ltr', slots: {} }) },
})
</script>
<template>
  <div :dir="props.layout.dir" :style="{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)' }">
    <aside :style="{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg, 2rem)', padding: 'var(--space-lg, 2rem)', borderInlineEnd: '1px solid var(--color-border)', background: 'var(--color-surface)' }">
      <strong v-if="props.layout.slots?.logo">{{ props.layout.slots.logo }}</strong>
      <NavList :items="props.layout.slots?.nav" :vertical="true" />
      <div :style="{ marginTop: 'auto' }">{{ props.layout.slots?.userMenu }}</div>
    </aside>
    <main :style="{ flex: 1, padding: 'var(--space-lg, 2rem)' }">
      <slot />
    </main>
  </div>
</template>
