import { setAdapter, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { definePermissions } from 'vike-rbac'
import { seedRbac, assignRoles } from 'vike-rbac/seed'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

const appPermissions = definePermissions([
  { name: 'users.view', label: 'View users', roles: ['admin'] },
  { name: 'users.edit', label: 'Edit users', roles: ['admin'] },
])

// Register the real mail/push transports when their secrets are present in the environment,
// so the same demo that runs on the dev outbox by default delivers for real once configured.
// onCreateGlobalContext is isomorphic (it also runs in the browser), so this is wrapped in
// `import.meta.env.SSR`: Vite replaces that with `false` in the client build and drops the
// whole branch, keeping the server-only transports (and their node:crypto) out of the client
// bundle. The imports are dynamic for the same reason. Push needs the matching public key too
// (the subscribe control reads it from the `vapidPublicKey` config, which falls back to the
// same VAPID_PUBLIC_KEY). With these unset the demo keeps the dev console/outbox transports.
async function registerProductionTransports() {
  // The whole body sits inside `if (import.meta.env.SSR)` so Vite turns it into `if (false)`
  // for the client build and dead-code-eliminates the block together with the dynamic
  // imports inside it - an early `return` would not, since the imports after it still anchor
  // a client chunk.
  if (import.meta.env.SSR) {
    const env = process.env
    if (env.RESEND_API_KEY) {
      const { setMailTransport } = await import('vike-mail')
      const { resendTransport } = await import('vike-mail/resend')
      setMailTransport(resendTransport({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM || 'Vike Data Demo <onboarding@resend.dev>',
      }))
    }
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
      const { setPushTransport } = await import('vike-push')
      const { webPushTransport } = await import('vike-push/web-push')
      setPushTransport(webPushTransport({
        subject: env.VAPID_SUBJECT || 'mailto:demo@example.com',
        vapidPublicKey: env.VAPID_PUBLIC_KEY,
        vapidPrivateKey: env.VAPID_PRIVATE_KEY,
      }))
    }
  }
}

export default async function onCreateGlobalContext() {
  if (getAdapter()) return // idempotent across dev HMR / double-eval
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  await registerProductionTransports()

  adapter.insert('users', { id: 'u-ada', email: 'ada@example.com', name: 'Ada Lovelace', active: true, created_at: daysAgo(40), updated_at: daysAgo(2) })
  adapter.insert('users', { id: 'u-alan', email: 'alan@example.com', name: 'Alan Turing', active: true, created_at: daysAgo(12), updated_at: daysAgo(1) })

  adapter.insert('sessions', { id: 's-1', user_id: 'u-ada', token: 'sess_demo_ada', created_at: daysAgo(1), updated_at: daysAgo(1) })

  await seedRbac(adapter, appPermissions, { roles: ['member'] })

  await assignRoles(adapter, 'u-ada', ['admin'])
  await assignRoles(adapter, 'u-alan', ['member'])
}
