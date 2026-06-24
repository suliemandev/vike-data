<script setup>
import { ref } from 'vue'
import { useTranslation } from 'vike-i18n/vue/hooks'
import { authMessages } from './messages.js'

const props = defineProps({
  action: { type: String, default: '/auth/request' },
  appName: { type: String, default: 'Acme' },
})

const { t } = useTranslation(authMessages.en)
const email = ref('')
const state = ref('idle') // idle | sending | sent | error

async function onSubmit(e) {
  e.preventDefault()
  state.value = 'sending'
  try {
    const body = new FormData()
    body.set('email', email.value)
    const next = new URLSearchParams(window.location.search).get('next')
    if (next) body.set('next', next)
    const res = await fetch(props.action, { method: 'POST', body })
    state.value = res.ok ? 'sent' : 'error'
  } catch {
    state.value = 'error'
  }
}

const field = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.6rem 0.7rem',
  marginTop: '0.35rem',
  borderRadius: 'var(--radius, 10px)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: '14px',
}
const primaryBtn = {
  width: '100%',
  marginTop: 'var(--space-md, 1rem)',
  padding: '0.6rem 0.7rem',
  borderRadius: 'var(--radius, 10px)',
  border: '1px solid transparent',
  background: 'var(--color-primary)',
  color: 'var(--color-primary-text)',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
}
</script>

<template>
  <div v-if="state === 'sent'">
    <h1 :style="{ margin: '0 0 0.5rem', fontSize: '20px' }">{{ t('auth.inboxTitle') }}</h1>
    <p :style="{ color: 'var(--color-muted)', fontSize: '14px', lineHeight: 1.6 }">
      {{ t('auth.inboxBody', { email: email }) }} {{ t('auth.devNote') }}
    </p>
    <button type="button" :style="{ ...primaryBtn, background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }" @click="state = 'idle'">
      {{ t('auth.different') }}
    </button>
  </div>
  <form v-else @submit="onSubmit">
    <h1 :style="{ margin: '0 0 0.25rem', fontSize: '20px' }">{{ t('auth.signIn', { app: appName }) }}</h1>
    <p :style="{ margin: '0 0 var(--space-lg, 1.5rem)', color: 'var(--color-muted)', fontSize: '14px' }">
      {{ t('auth.subtitle') }}
    </p>
    <label :style="{ display: 'block', fontSize: '13px', color: 'var(--color-muted)' }">
      {{ t('auth.email') }}
      <input
        type="email"
        required
        v-model="email"
        placeholder="you@example.com"
        autocomplete="email"
        :style="field"
      />
    </label>
    <button type="submit" :disabled="state === 'sending'" :style="{ ...primaryBtn, opacity: state === 'sending' ? 0.7 : 1 }">
      {{ state === 'sending' ? t('auth.sending') : t('auth.send') }}
    </button>
    <p v-if="state === 'error'" :style="{ color: '#dc2626', fontSize: '13px', marginTop: 'var(--space-md, 1rem)' }">{{ t('auth.error') }}</p>
    <p :style="{ marginTop: 'var(--space-lg, 1.5rem)', color: 'var(--color-muted)', fontSize: '12px', lineHeight: 1.5 }">
      {{ t('auth.footer') }}
    </p>
  </form>
</template>
