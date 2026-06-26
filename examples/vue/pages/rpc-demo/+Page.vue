<script setup>
import { ref, onMounted } from 'vue'
import { whoami, userCount } from './stats.telefunc.js'

const me = ref(undefined)
const count = ref(undefined)
const denied = ref(null)

onMounted(() => {
  whoami().then((v) => (me.value = v))
  userCount()
    .then((v) => (count.value = v))
    .catch((err) => {
      if (err && err.isAbort) denied.value = err.abortValue || 'Forbidden'
      else denied.value = 'Error'
    })
})
</script>
<template>
  <main :style="{ display: 'grid', gap: '1rem', maxWidth: '560px' }">
    <h1>RPC authorization</h1>
    <p>
      These results come from <code>*.telefunc.js</code> server functions called directly from the browser. The
      guarded one runs the same <code>can(user, 'users.view')</code> as the admin panel.
    </p>
    <section>
      <h2 :style="{ marginBottom: '0.25rem' }">whoami()</h2>
      <p v-if="me === undefined">Loading…</p>
      <p v-else-if="me === null">
        Signed out. <a href="/login">Sign in</a> as <code>ada@example.com</code> (admin) or <code>alan@example.com</code> (member).
      </p>
      <pre v-else :style="{ margin: 0 }">{{ JSON.stringify(me, null, 2) }}</pre>
    </section>
    <section>
      <h2 :style="{ marginBottom: '0.25rem' }">userCount() — requires users.view</h2>
      <p v-if="count !== undefined">There are <strong>{{ count }}</strong> users. (You hold <code>users.view</code>.)</p>
      <p v-else-if="denied">Denied: <code>{{ denied }}</code>. The RPC refused the call, exactly as the admin page would.</p>
      <p v-else>Loading…</p>
    </section>
  </main>
</template>
