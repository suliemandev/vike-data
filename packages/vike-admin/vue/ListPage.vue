<script setup>
import { useData } from 'vike-vue/useData'

const data = useData()

const cell = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '14px' }
const th = { ...cell, color: 'var(--color-muted)', fontWeight: 600 }

function listUrl(table, { page, sort, dir }) {
  const qs = new URLSearchParams()
  if (page && page > 1) qs.set('page', String(page))
  if (sort) {
    qs.set('sort', sort)
    if (dir === 'desc') qs.set('dir', 'desc')
  }
  const s = qs.toString()
  return s ? `/admin/${table}?${s}` : `/admin/${table}`
}

function formatValue(value, format) {
  if (value == null) return ''
  if (format === 'since') return relativeTime(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

function relativeTime(value) {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return String(value)
  const secs = Math.round((Date.now() - then) / 1000)
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [name, size] of units) {
    const n = Math.floor(secs / size)
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

function headerHref(c) {
  if (!c.sortable) return null
  const active = data.sort === c.name
  const nextDir = active && data.dir === 'asc' ? 'desc' : 'asc'
  return listUrl(data.table, { page: 1, sort: c.name, dir: nextDir })
}

function headerArrow(c) {
  if (data.sort !== c.name) return ''
  return data.dir === 'asc' ? ' ↑' : ' ↓'
}
</script>
<template>
  <div :style="{ maxWidth: '900px', margin: '0 auto' }">
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md, 1rem)' }">
      <h1 :style="{ margin: 0, fontSize: '22px' }">{{ data.label }}</h1>
      <a v-if="data.canEdit" :href="`/admin/${data.table}/new`" :style="{ background: 'var(--color-primary)', color: 'var(--color-primary-text, #fff)', padding: '0.45rem 0.9rem', borderRadius: 'var(--radius, 8px)', textDecoration: 'none', fontSize: '14px' }">+ New</a>
    </div>
    <div :style="{ overflowX: 'auto' }">
      <table :style="{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius, 10px)', overflow: 'hidden' }">
        <thead>
          <tr>
            <th v-for="c in data.columns" :key="c.name" :style="th">
              <a v-if="c.sortable" :href="headerHref(c)" :style="{ color: 'inherit', textDecoration: 'none' }">{{ c.label }}{{ headerArrow(c) }}</a>
              <template v-else>{{ c.label }}</template>
            </th>
            <th v-if="data.canEdit" :style="th"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.rows" :key="String(row[data.pk])">
            <td v-for="c in data.columns" :key="c.name" :style="cell">
              {{ data.fkLabels?.[c.name]?.[String(row[c.name])] ?? formatValue(row[c.name], c.format) }}
            </td>
            <td v-if="data.canEdit" :style="{ ...cell, textAlign: 'right' }">
              <a :href="`/admin/${data.table}/${encodeURIComponent(String(row[data.pk]))}`" :style="{ color: 'var(--color-primary)', fontSize: '13px', textDecoration: 'none' }">Edit</a>
            </td>
          </tr>
          <tr v-if="data.rows.length === 0">
            <td :colspan="data.columns.length + (data.canEdit ? 1 : 0)" :style="{ ...cell, color: 'var(--color-muted)', textAlign: 'center' }">No rows found.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div :style="{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-md, 1rem)', fontSize: '14px' }">
      <a v-if="data.page > 1" :href="listUrl(data.table, { page: data.page - 1, sort: data.sort, dir: data.dir })" :style="{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius, 8px)', border: '1px solid var(--color-border)', textDecoration: 'none', color: 'var(--color-text)' }">← Prev</a>
      <span v-else :style="{ padding: '0.35rem 0.75rem', color: 'var(--color-muted)', opacity: 0.5 }">← Prev</span>
      <span :style="{ color: 'var(--color-muted)' }">{{ data.page }} / {{ data.pageCount }}</span>
      <a v-if="data.page < data.pageCount" :href="listUrl(data.table, { page: data.page + 1, sort: data.sort, dir: data.dir })" :style="{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius, 8px)', border: '1px solid var(--color-border)', textDecoration: 'none', color: 'var(--color-text)' }">Next →</a>
      <span v-else :style="{ padding: '0.35rem 0.75rem', color: 'var(--color-muted)', opacity: 0.5 }">Next →</span>
      <span :style="{ marginInlineStart: 'auto', color: 'var(--color-muted)' }">{{ data.total }} rows</span>
    </div>
  </div>
</template>
