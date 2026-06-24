<script setup>
// <FileUpload> - the Vue upload control, the twin of vike-storage/react/FileUpload. A file
// input that uploads the chosen file to /uploads and emits `uploaded` with the stored record.
// Thin wrapper over the framework-agnostic client helpers (vike-storage/client); imports
// nothing server-side.
//
// The vike-admin `file` WIDGET (so an `.as('file')` column renders this in the admin form) is
// React-only for now; it lands for Vue once vike-admin ships a Vue widget registry (the fast
// follow noted with #177). This standalone control works today.
import { ref } from 'vue'
import { uploadFile } from '../client.js'

const props = defineProps({
  uploadUrl: { type: String, default: '/uploads' },
  label: { type: String, default: 'Upload a file' },
  accept: { type: String, default: undefined },
})
const emit = defineEmits(['uploaded'])

const busy = ref(false)
const error = ref(null)
const done = ref(null)

async function onChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  busy.value = true
  error.value = null
  try {
    const saved = await uploadFile(file, { uploadUrl: props.uploadUrl })
    done.value = saved
    emit('uploaded', saved)
  } catch (err) {
    error.value = err?.message || 'Upload failed'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span :style="{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px' }">
    <label :style="{ color: 'var(--color-muted)' }">
      {{ label }}
      <input type="file" :accept="accept" :disabled="busy" @change="onChange" />
    </label>
    <span v-if="busy" :style="{ color: 'var(--color-muted)' }">Uploading...</span>
    <a v-else-if="done" :href="done.url" target="_blank" rel="noreferrer" :style="{ color: 'var(--color-primary)' }">
      {{ done.filename || 'view' }}
    </a>
    <span v-if="error" :style="{ color: '#dc2626' }">{{ error }}</span>
  </span>
</template>
