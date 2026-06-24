import { getContext } from 'telefunc'
import { requirePermission } from 'vike-rbac/telefunc'
import { getAdapter } from '@universal-orm/core'

export async function whoami() {
  const { user } = getContext()
  if (!user) return null
  return { email: user.email, roles: user.roles, permissions: user.permissions }
}

export async function userCount() {
  requirePermission('users.view')
  const adapter = getAdapter()
  if (!adapter) return 0
  const rows = await adapter.find('users', {})
  return rows.length
}
