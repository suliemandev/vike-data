<script setup>
const props = defineProps({
  layout: { type: Object, default: () => ({ dir: 'ltr', slots: {} }) },
})
</script>
<template>
  <div :dir="props.layout.dir" :style="{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', padding: 'var(--space-lg, 2rem)', boxSizing: 'border-box' }">
    <div :style="{ width: '100%', maxWidth: '380px' }">
      <div v-if="props.layout.slots?.logo" :style="{ textAlign: 'center', marginBottom: 'var(--space-lg, 2rem)', fontWeight: 700, fontSize: '20px' }">
        {{ props.layout.slots.logo }}
      </div>
      <div :style="{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius, 10px)', padding: 'var(--space-lg, 2rem)' }">
        <slot />
      </div>
    </div>
  </div>
</template>
