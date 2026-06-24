<script setup>
import { useTranslation } from './context.js'
import { useToolbarSlot } from './useToolbarSlot.js'

const { locale, locales, setLocale } = useTranslation()
const slot = useToolbarSlot()

const LABELS = { en: 'English', fr: 'Français', ar: 'العربية', es: 'Español', de: 'Deutsch' }

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
  <template v-if="slot !== undefined && locales?.length > 1">
    <Teleport v-if="slot" :to="slot">
      <label :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }">
        <span :style="{ color: 'var(--color-muted)' }">Language</span>
        <select :value="locale" @change="setLocale($event.target.value)" :style="selectStyle">
          <option v-for="l in locales" :key="l" :value="l">{{ LABELS[l] || l }}</option>
        </select>
      </label>
    </Teleport>
    <div v-else :style="{ position: 'fixed', bottom: '16px', insetInlineStart: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.45rem 0.6rem', borderRadius: 'var(--radius, 10px)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '13px', fontFamily: 'var(--font-sans)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }">
      <label :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }">
        <span :style="{ color: 'var(--color-muted)' }">Language</span>
        <select :value="locale" @change="setLocale($event.target.value)" :style="selectStyle">
          <option v-for="l in locales" :key="l" :value="l">{{ LABELS[l] || l }}</option>
        </select>
      </label>
    </div>
  </template>
</template>
