<script setup>
import { computed } from 'vue'
import NavList from './NavList.vue'
const props = defineProps({
  layout: { type: Object, default: () => ({ dir: 'ltr', slots: {} }) },
})
// A nav item with `end: true` aligns to the trailing side, next to the user menu
// (#303); items without the flag keep their leading place. No `end` set = unchanged.
const startNav = computed(() => (props.layout.slots?.nav || []).filter((i) => !i.end))
const endNav = computed(() => (props.layout.slots?.nav || []).filter((i) => i.end))
</script>
<template>
  <div :dir="props.layout.dir" :style="{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)' }">
    <header :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-lg, 2rem)', padding: 'var(--space-md, 1rem) var(--space-lg, 2rem)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }">
      <div :style="{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg, 2rem)' }">
        <strong v-if="props.layout.slots?.logo">{{ props.layout.slots.logo }}</strong>
        <NavList :items="startNav" />
      </div>
      <div :style="{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg, 2rem)' }">
        <NavList v-if="endNav.length > 0" :items="endNav" />
        <span v-if="props.layout.slots?.userMenu">{{ props.layout.slots.userMenu }}</span>
      </div>
    </header>
    <main :style="{ flex: 1, padding: 'var(--space-lg, 2rem)' }">
      <slot />
    </main>
    <footer v-if="props.layout.slots?.footer?.length > 0" :style="{ padding: 'var(--space-md, 1rem) var(--space-lg, 2rem)', borderTop: '1px solid var(--color-border)' }">
      <NavList :items="props.layout.slots.footer" />
    </footer>
  </div>
</template>
