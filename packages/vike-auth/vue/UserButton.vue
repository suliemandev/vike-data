<script setup>
import { useUser } from './useUser.js'
import { useTranslation } from 'vike-i18n/vue/hooks'
import { authMessages } from './messages.js'

const props = defineProps({ loginHref: { type: String, default: '/login' } })
const user = useUser()
const { t } = useTranslation(authMessages.en)
</script>
<template>
  <a v-if="!user" :href="props.loginHref" :style="{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }">
    {{ t('auth.signInShort') }}
  </a>
  <div v-else :style="{ display: 'flex', alignItems: 'center', gap: 'var(--space-md, 1rem)' }">
    <span :style="{ fontSize: '14px', color: 'var(--color-muted)' }">{{ user.name || user.email }}</span>
    <form method="post" action="/auth/logout" :style="{ margin: 0 }">
      <button type="submit" :style="{ padding: '0.35rem 0.7rem', borderRadius: 'var(--radius, 10px)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '13px', cursor: 'pointer' }">
        {{ t('auth.logout') }}
      </button>
    </form>
  </div>
</template>
