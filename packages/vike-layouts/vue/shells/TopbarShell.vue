<script setup>
import NavList from './NavList.vue'
const props = defineProps({
  layout: { type: Object, default: () => ({ dir: 'ltr', slots: {} }) },
})
</script>
<template>
  <div :dir="props.layout.dir" :style="{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)' }">
    <header :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-lg, 2rem)', padding: 'var(--space-md, 1rem) var(--space-lg, 2rem)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }">
      <div :style="{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg, 2rem)' }">
        <strong v-if="props.layout.slots?.logo">{{ props.layout.slots.logo }}</strong>
        <NavList :items="props.layout.slots?.nav" />
      </div>
      <span v-if="props.layout.slots?.userMenu">{{ props.layout.slots.userMenu }}</span>
    </header>
    <main :style="{ flex: 1, padding: 'var(--space-lg, 2rem)' }">
      <slot />
    </main>
    <footer v-if="props.layout.slots?.footer?.length > 0" :style="{ padding: 'var(--space-md, 1rem) var(--space-lg, 2rem)', borderTop: '1px solid var(--color-border)' }">
      <NavList :items="props.layout.slots.footer" />
    </footer>
  </div>
</template>
