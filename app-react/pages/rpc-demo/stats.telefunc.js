// Telefunctions: server functions the browser calls directly (telefunc transforms
// this file into a typed RPC client). The point of the demo is #110 — the SAME
// can()/hasRole() that guards the admin page guards these RPCs, because vike-rbac's
// telefunc middleware hands each call the signed-in, role-enriched user on the
// Telefunc context.
//
// getContext() / the require* guards must run BEFORE the first `await` (Telefunc
// reads the context synchronously at call entry).
import { getContext } from 'telefunc'
import { requirePermission } from 'vike-rbac/telefunc'
import { getAdapter } from '@universal-orm/core'

// Anyone may ask who they are — proves the context user reaches the RPC, enriched
// with roles/permissions (the same object a page sees on pageContext.user).
export async function whoami() {
  const { user } = getContext()
  if (!user) return null
  return { email: user.email, roles: user.roles, permissions: user.permissions }
}

// Guarded: only a caller holding `users.view` may read the user count. Ada (admin)
// gets a number; Alan (member) and an anonymous caller get a Telefunc Abort, which
// the client receives as err.isAbort — the RPC enforces exactly what the admin's
// canView: can(user, 'users.view') enforces on the page.
export async function userCount() {
  requirePermission('users.view') // throws Abort('Forbidden') unless allowed
  const adapter = getAdapter()
  if (!adapter) return 0
  const rows = await adapter.find('users', {})
  return rows.length
}
