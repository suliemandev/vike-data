// Server-only data for the home page, one block per "which subject" seam:
//
//   - adminUploads: when the STAFF (admin) guard is signed in, that admin's OWN uploads from the
//     `uploads` table — rows vike-storage wrote with `user_id` = the admin subject's id
//     (storageGuard: 'admin', #278 / #207 P3). The proof a staff upload is owned by `admins`.
//   - clientNotifications: when the CLIENT guard is signed in, that client's OWN in-app feed from
//     the `notifications` table — rows vike-notifications wrote with `user_id` = the client
//     subject's id (notificationsGuard: 'client', #279 / #207 P3). The proof a notification is
//     owned by `clients`, not the default user.
//
// Each is empty without that guard's session. data() touches the adapter, so it runs server-side;
// the page reads it with useData. `pageContext.guards.<name>.user` is resolved by vike-auth's
// guards render hook (server-only), which runs before data(); the default user lives on
// `pageContext.user`.
import { getAdapter } from '@universal-orm/core'

export async function data(pageContext) {
  const adapter = getAdapter()
  const admin = pageContext.guards?.admin?.user
  const client = pageContext.guards?.client?.user

  const adminUploads = admin && adapter ? (await adapter.find('uploads', { user_id: admin.id })).map((r) => ({
    id: r.id,
    filename: r.filename,
    mime: r.mime,
    size: r.size,
    url: `/uploads/${r.storage_key}`,
  })) : []

  // Newest first, the same shape vike-notifications' feed helper returns: `data` is the JSON
  // string the database channel stored (the rendered { title, body }), `read` = read_at is set.
  const clientNotifications = client && adapter ? (await adapter.find('notifications', { user_id: client.id }, { orderBy: { column: 'created_at', dir: 'desc' } })).map((r) => {
    const payload = JSON.parse(r.data || 'null') || {}
    return { id: r.id, type: r.type, title: payload.title, body: payload.body, read: r.read_at != null }
  }) : []

  return { adminUploads, clientNotifications }
}
