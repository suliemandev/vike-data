<script setup>
const props = defineProps({
  fields: { type: Array, required: true },
  values: { type: Object, default: () => ({}) },
})

const labelStyle = { display: 'block', color: 'var(--color-muted)', fontSize: '13px', marginBottom: '4px' }
const controlStyle = {
  width: '100%',
  padding: '0.5rem 0.6rem',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 8px)',
  background: 'var(--color-bg, #fff)',
  color: 'var(--color-text)',
  fontSize: '14px',
  boxSizing: 'border-box',
}

function htmlType(type) {
  return type === 'integer' ? 'number' : type === 'email' ? 'email' : 'text'
}
</script>
<template>
  <template v-for="f in props.fields" :key="f.name">
    <label v-if="f.type === 'boolean'" :style="{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }">
      <input type="checkbox" :name="f.name" :checked="!!props.values[f.name]" />
      {{ f.label }}
    </label>
    <div v-else-if="f.fk || f.type === 'select'">
      <label :style="labelStyle" :for="f.name">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
      <select :id="f.name" :name="f.name" :required="f.required" :value="props.values[f.name] ?? ''" :style="controlStyle">
        <option v-if="!f.required" value="">—</option>
        <option v-for="o in (f.options ?? [])" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div v-else>
      <label :style="labelStyle" :for="f.name">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
      <input
        :id="f.name"
        :name="f.name"
        :type="htmlType(f.type)"
        :required="f.required"
        :value="props.values[f.name] ?? ''"
        :style="controlStyle"
      />
    </div>
  </template>
</template>
