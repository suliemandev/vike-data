import { setAdapter, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { definePermissions } from 'vike-rbac'
import { seedRbac, assignRoles } from 'vike-rbac/seed'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

const appPermissions = definePermissions([
  { name: 'users.view', label: 'View users', roles: ['admin'] },
  { name: 'users.edit', label: 'Edit users', roles: ['admin'] },
])

export default async function onCreateGlobalContext() {
  if (getAdapter()) return // idempotent across dev HMR / double-eval
  const adapter = createMemoryAdapter()
  setAdapter(adapter)

  adapter.insert('users', { id: 'u-ada', email: 'ada@example.com', name: 'Ada Lovelace', active: true, created_at: daysAgo(40), updated_at: daysAgo(2) })
  adapter.insert('users', { id: 'u-alan', email: 'alan@example.com', name: 'Alan Turing', active: true, created_at: daysAgo(12), updated_at: daysAgo(1) })

  adapter.insert('sessions', { id: 's-1', user_id: 'u-ada', token: 'sess_demo_ada', created_at: daysAgo(1), updated_at: daysAgo(1) })

  await seedRbac(adapter, appPermissions, { roles: ['member'] })

  await assignRoles(adapter, 'u-ada', ['admin'])
  await assignRoles(adapter, 'u-alan', ['member'])
}
