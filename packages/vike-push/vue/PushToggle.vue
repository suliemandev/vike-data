<script setup>
// <PushToggle> - the Vue subscribe control, the twin of vike-push/react/PushToggle.
// Thin wrapper over the framework-agnostic client helpers (vike-push/client); imports
// nothing server-side. The VAPID public key comes from the prop or the app's
// `vapidPublicKey` config off pageContext.
import { ref, onMounted } from 'vue'
import { usePageContext } from 'vike-vue/usePageContext'
import { isPushSupported, subscribe, unsubscribe, getExistingSubscription } from '../client.js'

const props = defineProps({
  vapidPublicKey: { type: String, default: '' },
  swUrl: { type: String, default: '/vike-push-sw.js' },
  label: { type: String, default: 'Notifications' },
})

const pageContext = usePageContext()
const key = props.vapidPublicKey || pageContext?.config?.vapidPublicKey

const supported = ref(false)
const subscribed = ref(false)
const busy = ref(false)
const error = ref(null)

onMounted(async () => {
  supported.value = isPushSupported()
  try {
    subscribed.value = !!(await getExistingSubscription())
  } catch {
    // ignore
  }
})

async function onClick() {
  busy.value = true
  error.value = null
  try {
    if (subscribed.value) {
      await unsubscribe({})
      subscribed.value = false
    } else {
      await subscribe({ vapidPublicKey: key, swUrl: props.swUrl })
      subscribed.value = true
    }
  } catch (e) {
    error.value = e?.message || 'Something went wrong'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span v-if="!supported" :style="{ color: 'var(--color-muted)', fontSize: '13px' }">Push not supported here</span>
  <span v-else :style="{ display: 'inline-flex', alignItems: 'center', gap: '8px' }">
    <button
      type="button"
      @click="onClick"
      :disabled="busy"
      :style="{
        padding: '0.35rem 0.7rem',
        borderRadius: 'var(--radius, 10px)',
        border: '1px solid var(--color-border)',
        background: subscribed ? 'var(--color-surface)' : 'var(--color-primary)',
        color: subscribed ? 'var(--color-text)' : 'var(--color-primary-text, #fff)',
        fontSize: '13px',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.7 : 1,
      }"
    >
      {{ busy ? '...' : subscribed ? `Disable ${label}` : `Enable ${label}` }}
    </button>
    <span v-if="error" :style="{ color: '#dc2626', fontSize: '12px' }">{{ error }}</span>
  </span>
</template>
