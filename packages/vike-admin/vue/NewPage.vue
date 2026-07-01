<script setup>
import { useData } from 'vike-vue/useData'
import { FormFields } from './FormFields.js'

const data = useData()

function singular(word) {
  return word?.endsWith('s') ? word.slice(0, -1) : word
}
</script>
<template>
  <div v-if="!data.apiWrite" :style="{ maxWidth: '520px', margin: '0 auto' }">
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
      <h1 :style="{ margin: 0, fontSize: '22px' }">New {{ singular(data.label) }}</h1>
      <a :href="`/admin/${data.table}`" :style="{ color: 'var(--color-muted)', fontSize: '14px' }">← {{ data.label }}</a>
    </div>
    <form method="post" :action="`/admin/${data.table}/new`" :style="{ marginTop: 'var(--space-md, 1rem)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius, 10px)', padding: 'var(--space-lg, 1.5rem)', display: 'grid', gap: 'var(--space-md, 1rem)' }">
      <FormFields :fields="data.fields" />
      <div>
        <button type="submit" :style="{ background: 'var(--color-primary)', color: 'var(--color-primary-text, #fff)', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 'var(--radius, 8px)', fontSize: '14px', cursor: 'pointer' }">Create</button>
      </div>
    </form>
  </div>
</template>
