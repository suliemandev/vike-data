<script setup>
import { computed } from 'vue'
import NavList from './NavList.vue'
const props = defineProps({
  layout: { type: Object, default: () => ({ dir: 'ltr', slots: {} }) },
})
// `end: true` items sink to the bottom of the sidebar, above the user menu (#303);
// the rest stay at the top under the logo. No `end` set = unchanged.
const startNav = computed(() => (props.layout.slots?.nav || []).filter((i) => !i.end))
const endNav = computed(() => (props.layout.slots?.nav || []).filter((i) => i.end))
</script>
<template>
  <div :dir="props.layout.dir" :style="{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)' }">
    <aside :style="{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg, 2rem)', padding: 'var(--space-lg, 2rem)', borderInlineEnd: '1px solid var(--color-border)', background: 'var(--color-surface)' }">
      <strong v-if="props.layout.slots?.logo">{{ props.layout.slots.logo }}</strong>
      <NavList :items="startNav" :vertical="true" />
      <div :style="{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg, 2rem)' }">
        <NavList v-if="endNav.length > 0" :items="endNav" :vertical="true" />
        <span v-if="props.layout.slots?.userMenu">{{ props.layout.slots?.userMenu }}</span>
      </div>
    </aside>
    <main :style="{ flex: 1, padding: 'var(--space-lg, 2rem)' }">
      <slot />
    </main>
  </div>
</template>
