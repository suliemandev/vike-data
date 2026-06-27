// Server-only data for the home page: the signed-in user's organization and the org's shared
// files. The files are scoped by `organization_id`, NOT `user_id` (#250) — so the SAME list
// renders for every member of the org. That is the whole proof: sign in as Ada, then as Grace,
// and both see the identical set of org files.
//
// data() touches the adapter, so it runs server-side; the page reads it with useData.
// `pageContext.user` is the default user guard's subject, resolved by vike-auth's render hook
// (server-only) before data() runs. We re-read the full row so `current_organization_id` (teams'
// added column) is present even if the session subject is minimal.
import { getAdapter } from '@universal-orm/core'

export async function data(pageContext) {
  const adapter = getAdapter()
  const sessionUser = pageContext.user
  if (!sessionUser || !adapter) return { user: null, org: null, members: [], uploads: [] }

  const row = (await adapter.find('users', { id: sessionUser.id }))[0] || sessionUser
  const orgId = row.current_organization_id
  const org = orgId ? (await adapter.find('organizations', { id: orgId }))[0] : null

  // The org's files, owned by `organization_id` (storageOwner, #250). Newest first.
  const uploads = orgId
    ? (await adapter.find('uploads', { organization_id: orgId }, { orderBy: { column: 'created_at', dir: 'desc' } })).map((r) => ({
        id: r.id,
        filename: r.filename,
        mime: r.mime,
        size: r.size,
        url: `/uploads/${r.storage_key}`,
      }))
    : []

  // The org's members — the "who else can see and delete these files" context.
  const memberships = orgId ? await adapter.find('memberships', { organization_id: orgId }) : []
  const members = []
  for (const m of memberships) {
    const u = (await adapter.find('users', { id: m.user_id }))[0]
    if (u) members.push({ id: u.id, name: u.name, email: u.email, role: m.role })
  }

  return {
    user: { id: row.id, email: row.email, name: row.name },
    org: org ? { id: org.id, name: org.name } : null,
    members,
    uploads,
  }
}
