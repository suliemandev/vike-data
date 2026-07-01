<script setup>
// /admin/:table — the list. The TABLE (columns, sortable headers, FK cells, per-row edit link,
// empty state) is rendered by vike-view/vue's ListView — vike-admin is a preset over vike-view, so
// it draws its list through the same component instead of a second table (mirrors
// vike-admin/react/ListPage). This page keeps the admin CHROME around it: the title, the "New"
// button, and prev/next paging. Navigation is plain query-string links (`?page=&sort=&dir=`), so
// it works without client JS.
import { useData } from 'vike-vue/useData'
import { ListView } from 'vike-view/vue'

const data = useData()

// Build an /admin/:table URL carrying the paging/sort state; empty params are dropped so a default
// view stays a clean `/admin/:table`.
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

// ListView's function props: a sortable header links to the same list sorted by its column; a row
// links to its edit page (only when the user may edit — so no edit column otherwise).
const sortHref = (name, nextDir) => listUrl(data.table, { page: 1, sort: name, dir: nextDir })
const rowHref = data.canEdit ? (row) => `/admin/${data.table}/${encodeURIComponent(String(row[data.pk]))}` : undefined

const pagerLink = { padding: '0.35rem 0.75rem', borderRadius: 'var(--radius, 8px)', border: '1px solid var(--color-border)', textDecoration: 'none', color: 'var(--color-text)' }
const pagerDisabled = { padding: '0.35rem 0.75rem', color: 'var(--color-muted)', opacity: 0.5 }
</script>
<template>
  <div :style="{ maxWidth: '900px', margin: '0 auto' }">
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md, 1rem)' }">
      <h1 :style="{ margin: 0, fontSize: '22px' }">{{ data.label }}</h1>
      <a v-if="data.canEdit" :href="`/admin/${data.table}/new`" :style="{ background: 'var(--color-primary)', color: 'var(--color-primary-text, #fff)', padding: '0.45rem 0.9rem', borderRadius: 'var(--radius, 8px)', textDecoration: 'none', fontSize: '14px' }">+ New</a>
    </div>
    <div :style="{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius, 10px)', overflow: 'hidden', background: 'var(--color-surface)' }">
      <ListView
        :table="data.table"
        :columns="data.columns"
        :rows="data.rows"
        :pk="data.pk"
        :fkLabels="data.fkLabels"
        :sort="data.sort"
        :dir="data.dir"
        :sortHref="sortHref"
        :rowHref="rowHref"
        empty-label="No rows found."
      />
    </div>
    <div :style="{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-md, 1rem)', fontSize: '14px' }">
      <a v-if="data.page > 1" :href="listUrl(data.table, { page: data.page - 1, sort: data.sort, dir: data.dir })" :style="pagerLink">← Prev</a>
      <span v-else :style="pagerDisabled">← Prev</span>
      <span :style="{ color: 'var(--color-muted)' }">{{ data.page }} / {{ data.pageCount }}</span>
      <a v-if="data.page < data.pageCount" :href="listUrl(data.table, { page: data.page + 1, sort: data.sort, dir: data.dir })" :style="pagerLink">Next →</a>
      <span v-else :style="pagerDisabled">Next →</span>
      <span :style="{ marginInlineStart: 'auto', color: 'var(--color-muted)' }">{{ data.total }} rows</span>
    </div>
  </div>
</template>
