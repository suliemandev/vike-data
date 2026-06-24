<script setup>
import { useData } from 'vike-vue/useData'
const data = useData()
</script>
<template>
  <div :style="{ maxWidth: '760px', margin: '0 auto' }">
    <h1 :style="{ marginTop: 0, fontSize: '22px' }">Admin</h1>
    <p v-if="data.resources.length === 0" :style="{ color: 'var(--color-muted)' }">No resources have been contributed yet.</p>
    <div v-else :style="{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md, 1rem)' }">
      <a
        v-for="r in data.resources"
        :key="r.table"
        :href="`/admin/${r.table}`"
        :style="{ display: 'block', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius, 10px)', padding: 'var(--space-md, 1rem) var(--space-lg, 1.5rem)', textDecoration: 'none', color: 'var(--color-text)' }"
      >
        <div :style="{ fontSize: '16px', fontWeight: 600 }">{{ r.label }}</div>
        <div :style="{ color: 'var(--color-muted)', fontSize: '13px', marginTop: '4px' }"><code>{{ r.table }}</code></div>
      </a>
    </div>
  </div>
</template>
