<script setup>
// <NotificationsBell> — the Vue in-app feed control, the twin of
// vike-notifications/react/Bell. A bell with an unread badge that opens a feed list;
// "Mark all read" clears the badge. Thin wrapper over the framework-agnostic client
// helpers (vike-notifications/client); imports nothing server-side.
import { ref, onMounted, onUnmounted } from 'vue'
import { fetchFeed, markRead } from '../client.js'

const props = defineProps({
  label: { type: String, default: 'Notifications' },
  pollMs: { type: Number, default: 0 },
})

const items = ref([])
const unread = ref(0)
const open = ref(false)
const error = ref(null)
let timer = null

async function load() {
  try {
    const res = await fetchFeed({})
    items.value = res.items
    unread.value = res.unread
    error.value = null
  } catch (e) {
    error.value = e?.message || 'Failed to load'
  }
}

async function onMarkAll() {
  try {
    await markRead(null, {})
    await load()
  } catch (e) {
    error.value = e?.message || 'Failed to mark read'
  }
}

onMounted(() => {
  load()
  if (props.pollMs) timer = setInterval(load, props.pollMs)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <span :style="{ position: 'relative', display: 'inline-flex', alignItems: 'center' }">
    <button
      type="button"
      :aria-label="label"
      @click="open = !open"
      :style="{
        position: 'relative',
        padding: '0.35rem 0.6rem',
        borderRadius: 'var(--radius, 10px)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: '15px',
        cursor: 'pointer',
      }"
    >
      &#x1F514;
      <span
        v-if="unread > 0"
        :style="{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          minWidth: '16px',
          height: '16px',
          padding: '0 4px',
          borderRadius: '999px',
          background: '#dc2626',
          color: '#fff',
          fontSize: '10px',
          lineHeight: '16px',
          textAlign: 'center',
        }"
        >{{ unread > 99 ? '99+' : unread }}</span
      >
    </button>

    <div
      v-if="open"
      :style="{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: '320px',
        maxHeight: '380px',
        overflowY: 'auto',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius, 10px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        zIndex: 50,
      }"
    >
      <div
        :style="{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 0.75rem',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '13px',
          fontWeight: 600,
        }"
      >
        <span>{{ label }}</span>
        <button
          v-if="unread > 0"
          type="button"
          @click="onMarkAll"
          :style="{ border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: '12px', cursor: 'pointer' }"
        >
          Mark all read
        </button>
      </div>

      <div v-if="error" :style="{ padding: '0.6rem 0.75rem', color: '#dc2626', fontSize: '12px' }">{{ error }}</div>

      <div v-if="items.length === 0" :style="{ padding: '1rem 0.75rem', color: 'var(--color-muted)', fontSize: '13px' }">
        Nothing yet
      </div>
      <div
        v-else
        v-for="n in items"
        :key="n.id"
        :style="{
          padding: '0.6rem 0.75rem',
          borderBottom: '1px solid var(--color-border)',
          background: n.read ? 'transparent' : 'var(--color-primary-soft, rgba(59,130,246,0.08))',
          fontSize: '13px',
        }"
      >
        <div :style="{ fontWeight: n.read ? 400 : 600 }">{{ n.data?.title ?? n.type }}</div>
        <div v-if="n.data?.body" :style="{ color: 'var(--color-muted)', marginTop: '2px' }">{{ n.data.body }}</div>
      </div>
    </div>
  </span>
</template>
