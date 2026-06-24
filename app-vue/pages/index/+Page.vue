<script setup>
import UserButton from 'vike-auth/vue/UserButton'
import { useUser } from 'vike-auth/vue/hooks'
import { useTranslation } from 'vike-i18n/vue/hooks'

const user = useUser()
const { t } = useTranslation()
</script>
<template>
  <div :style="{ maxWidth: '640px', margin: '0 auto' }">
    <div :style="{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }">
      <UserButton />
    </div>
    <h1 :style="{ marginTop: 0 }">{{ t('app.homeTitle') }}</h1>
    <p v-if="user" :style="{ color: 'var(--color-muted)' }">
      {{ t('app.signedInAs') }} <strong :style="{ color: 'var(--color-text)' }">{{ user.email }}</strong>.
    </p>
    <p v-else :style="{ color: 'var(--color-muted)' }">
      {{ t('app.signedOut') }}
      <a href="/login" :style="{ color: 'var(--color-primary)' }">{{ t('app.signInLink') }}</a>
      {{ t('app.signInPrompt') }}
    </p>
    <p :style="{ color: 'var(--color-muted)', fontSize: '14px', lineHeight: 1.7 }">{{ t('app.blurb') }}</p>
  </div>
</template>
