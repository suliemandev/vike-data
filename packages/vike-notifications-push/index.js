// vike-notifications-push — the PUSH channel adapter.
//
// Registers a `push` channel into vike-notifications and delivers through vike-push's
// sendPush. A SEPARATE package (not part of the notifications core) so the core stays
// closed for modification: adding a channel is a new adapter package like this one, never
// an edit to vike-notifications. Depends on BOTH vike-notifications and vike-push; neither
// of those depends on this.
//
// Importing this module self-registers the channel — install the package and
// `via: ['push']` works. `registerPushChannel()` is also exported for explicit or repeat
// registration (e.g. tests, which clear the registry between cases).
import { registerChannel, routeFor } from 'vike-notifications'
import { sendPush } from 'vike-push'

// The channel contract: { name, send(notifiable, rendered) }. `rendered` is the
// notification's toPush(user) output — the push payload (title / body / ...). The TARGET
// is the user id from the notifiable via routeFor (push is user-based: vike-push looks up
// that user's stored subscriptions), NOT read inline, so a future non-User notifiable is
// handled in one place (#206).
export const pushChannel = {
  name: 'push',
  async send(notifiable, rendered) {
    return sendPush(routeFor(notifiable, 'push'), rendered)
  },
}

/** Register the push channel into vike-notifications (idempotent — last registration wins). */
export function registerPushChannel() {
  return registerChannel(pushChannel)
}

// Self-register on import.
registerPushChannel()

export default registerPushChannel
