<script setup>
import { ref, onMounted } from 'vue'
import logoSvg from './vike-logo.svg?raw'
import { TOOLBAR_ROOT_ID, TOOLBAR_ITEMS_ID } from '../index.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

const open = ref(false)
const root = ref(null)

const logoMarkup = logoSvg.replace('width="38"', 'width="24"').replace('height="38"', 'height="24"')

onMounted(() => {
  const el = document.getElementById(TOOLBAR_ROOT_ID)
  if (el) { root.value = el; return }
  const obs = new MutationObserver(() => {
    const node = document.getElementById(TOOLBAR_ROOT_ID)
    if (node) { root.value = node; obs.disconnect() }
  })
  obs.observe(document.body, { childList: true, subtree: true })
})

const FIXED = { position: 'fixed', insetInlineStart: '16px', zIndex: 50, fontFamily: 'var(--font-sans)' }
</script>
<template>
  <Teleport v-if="root" :to="root">
    <div
      role="dialog"
      aria-label="Settings"
      :style="{ ...FIXED, bottom: '72px', minWidth: '220px', flexDirection: 'column', gap: '12px', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius, 10px)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '13px', boxShadow: '0 2px 12px rgba(0,0,0,0.14)', display: open ? 'flex' : 'none' }"
    >
      <div v-for="item in props.items" :key="item.id" :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }">
        <span v-if="item.label" :style="{ color: 'var(--color-muted)' }">{{ item.label }}</span>
        <component :is="item.Control" />
      </div>
      <!-- Teleport target for other extensions' live controls. Empty + display:contents
           so its (externally-teleported) children flow into the panel's column. -->
      <div :id="TOOLBAR_ITEMS_ID" :style="{ display: 'contents' }" />
    </div>
  </Teleport>
  <button
    type="button"
    aria-label="Open settings"
    :aria-expanded="open"
    @click="open = !open"
    :style="{ ...FIXED, bottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', padding: 0, borderRadius: '50%', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }"
  >
    <span aria-hidden="true" :style="{ display: 'flex', width: '24px', height: '24px' }" v-html="logoMarkup" />
  </button>
</template>
