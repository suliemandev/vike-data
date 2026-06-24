<script setup>
const props = defineProps({
  items: { type: Array, default: () => [] },
  vertical: { type: Boolean, default: false },
})
</script>
<template>
  <nav :style="{ display: 'flex', flexDirection: props.vertical ? 'column' : 'row', gap: 'var(--space-md, 1rem)' }">
    <a
      v-for="item in props.items"
      :key="item.href ?? item.label"
      :href="item.href"
      :style="{ color: 'var(--color-muted)', textDecoration: 'none', fontSize: '14px' }"
    >{{ item.label }}</a>
  </nav>
</template>
