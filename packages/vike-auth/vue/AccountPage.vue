<script setup>
import { useUser } from './useUser.js'
import UserButton from './UserButton.vue'
import { useTranslation } from 'vike-i18n/vue/hooks'
import { authMessages } from './messages.js'

const user = useUser()
const { t } = useTranslation(authMessages.en)
</script>
<template>
  <div :style="{ maxWidth: '640px', margin: '0 auto' }">
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
      <h1 :style="{ margin: 0, fontSize: '22px' }">{{ t('auth.accountTitle') }}</h1>
      <UserButton />
    </div>
    <div v-if="user" :style="{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius, 10px)', padding: 'var(--space-lg, 1.5rem)', marginTop: 'var(--space-md, 1rem)' }">
      <div :style="{ display: 'flex', gap: '0.5rem', fontSize: '14px', lineHeight: 1.9 }">
        <span :style="{ color: 'var(--color-muted)', minWidth: '110px' }">{{ t('auth.accountSignedInAs') }}</span>
        <strong :style="{ color: 'var(--color-text)' }">{{ user.email }}</strong>
      </div>
      <div v-if="user.name" :style="{ display: 'flex', gap: '0.5rem', fontSize: '14px', lineHeight: 1.9 }">
        <span :style="{ color: 'var(--color-muted)', minWidth: '110px' }">{{ t('auth.accountName') }}</span>
        <span :style="{ color: 'var(--color-text)' }">{{ user.name }}</span>
      </div>
    </div>
    <p v-else :style="{ color: 'var(--color-muted)', marginTop: 'var(--space-md, 1rem)' }">
      {{ t('auth.accountSignedOut') }}
      <a href="/login" :style="{ color: 'var(--color-primary)' }">{{ t('auth.signInShort') }}</a>
    </p>
  </div>
</template>
