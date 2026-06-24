<script setup>
// The form inputs shared by the create and edit pages, dispatched on each field's `widget`
// token (derived in resolve.js from the column's `.as()` semantic, #176): a checkbox for
// booleans, a select for foreign keys + enums, a textarea for long text / json, a typed input
// otherwise. This is built-in parity with the React widgets; the cross-extension widget
// REGISTRY (so an extension can add e.g. a `file` control) is React-first for now — a Vue
// registry is a fast follow, tracked alongside vike-storage (#178).
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

// The rendering token: the semantic-aware `widget` if present, else the coercion `type`.
const widgetOf = (f) => f.widget ?? f.type
const isBoolean = (f) => widgetOf(f) === 'boolean'
const isSelect = (f) => !!f.fk || widgetOf(f) === 'select' || widgetOf(f) === 'enum'
const isTextarea = (f) => widgetOf(f) === 'longtext' || widgetOf(f) === 'json'
const htmlType = (f) => {
  const w = widgetOf(f)
  return w === 'integer' ? 'number' : w === 'email' ? 'email' : w === 'date' ? 'date' : 'text'
}
</script>
<template>
  <template v-for="f in props.fields" :key="f.name">
    <label v-if="isBoolean(f)" :style="{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }">
      <input type="checkbox" :name="f.name" :checked="!!props.values[f.name]" />
      {{ f.label }}
    </label>
    <div v-else-if="isSelect(f)">
      <label :style="labelStyle" :for="f.name">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
      <select :id="f.name" :name="f.name" :required="f.required" :value="props.values[f.name] ?? ''" :style="controlStyle">
        <option v-if="!f.required" value="">—</option>
        <option v-for="o in (f.options ?? [])" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div v-else-if="isTextarea(f)">
      <label :style="labelStyle" :for="f.name">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
      <textarea
        :id="f.name"
        :name="f.name"
        :required="f.required"
        :rows="widgetOf(f) === 'json' ? 6 : 4"
        :value="props.values[f.name] ?? ''"
        :style="{ ...controlStyle, resize: 'vertical', ...(widgetOf(f) === 'json' ? { fontFamily: 'var(--font-mono, monospace)' } : {}) }"
      />
    </div>
    <div v-else>
      <label :style="labelStyle" :for="f.name">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
      <input
        :id="f.name"
        :name="f.name"
        :type="htmlType(f)"
        :required="f.required"
        :value="props.values[f.name] ?? ''"
        :style="controlStyle"
      />
    </div>
  </template>
</template>
