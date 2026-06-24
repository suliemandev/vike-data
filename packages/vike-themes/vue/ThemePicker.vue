<script setup>
import { computed } from 'vue'
import { useTheme } from './context.js'
import { useToolbarSlot } from './useToolbarSlot.js'

const { themeName, names, setTheme, appearance, appearances, setAppearance } = useTheme()
const slot = useToolbarSlot()

const hasMultipleThemes = computed(() => names.value.length > 1)

function prettyLabel(name) {
  return String(name).split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

const selectStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 8px)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  padding: '0.25rem 0.4rem',
  fontSize: '13px',
}
</script>
<template>
  <!-- pending: render nothing until we know if toolbar is installed -->
  <template v-if="slot !== undefined">
    <!-- toolbar installed: teleport controls into its popover -->
    <Teleport v-if="slot" :to="slot">
      <label :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }">
        <span :style="{ color: 'var(--color-muted)' }">Appearance</span>
        <select :value="appearance" @change="setAppearance($event.target.value)" :style="selectStyle">
          <option v-for="a in appearances" :key="a" :value="a">{{ prettyLabel(a) }}</option>
        </select>
      </label>
      <label v-if="hasMultipleThemes" :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }">
        <span :style="{ color: 'var(--color-muted)' }">Theme</span>
        <select :value="themeName" @change="setTheme($event.target.value)" :style="selectStyle">
          <option v-for="n in names" :key="n" :value="n">{{ prettyLabel(n) }}</option>
        </select>
      </label>
    </Teleport>
    <!-- no toolbar: standalone fixed picker (bottom-right) -->
    <div v-else :style="{ position: 'fixed', bottom: '16px', insetInlineEnd: '16px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.6rem 0.7rem', borderRadius: 'var(--radius, 10px)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '13px', fontFamily: 'var(--font-sans)', boxShadow: '0 1px 6px rgba(0,0,0,0.1)' }">
      <label :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }">
        <span :style="{ color: 'var(--color-muted)' }">Appearance</span>
        <select :value="appearance" @change="setAppearance($event.target.value)" :style="selectStyle">
          <option v-for="a in appearances" :key="a" :value="a">{{ prettyLabel(a) }}</option>
        </select>
      </label>
      <label v-if="hasMultipleThemes" :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }">
        <span :style="{ color: 'var(--color-muted)' }">Theme</span>
        <select :value="themeName" @change="setTheme($event.target.value)" :style="selectStyle">
          <option v-for="n in names" :key="n" :value="n">{{ prettyLabel(n) }}</option>
        </select>
      </label>
    </div>
  </template>
</template>
