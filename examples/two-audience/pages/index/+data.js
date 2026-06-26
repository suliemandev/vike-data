// Server-only data for the home page: when the STAFF (admin) guard is signed in, list that
// admin's OWN uploads from the `uploads` table. These are the rows vike-storage wrote with
// `user_id` = the admin subject's id (storageGuard: 'admin', #278 / #207 P3) — the proof a
// staff upload is owned by the `admins` audience, not the default user. Empty when no admin
// session. It touches the adapter, so it runs server-side; the page reads it with useData.
//
// `pageContext.guards.admin.user` is resolved by vike-auth's guards render hook (server-only),
// which runs before data(); the default user lives on `pageContext.user`.
import { getAdapter } from '@universal-orm/core'

export async function data(pageContext) {
  const admin = pageContext.guards?.admin?.user
  const adapter = getAdapter()
  if (!admin || !adapter) return { adminUploads: [] }
  const rows = await adapter.find('uploads', { user_id: admin.id })
  return {
    adminUploads: rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      mime: r.mime,
      size: r.size,
      url: `/uploads/${r.storage_key}`,
    })),
  }
}
