// vike-notifications-mail — the MAIL channel adapter.
//
// Registers a `mail` channel into vike-notifications and delivers through vike-mail's
// sendMail. A SEPARATE package (not part of the notifications core) so the core stays
// closed for modification: adding a channel is a new adapter package like this one, never
// an edit to vike-notifications. Depends on BOTH vike-notifications and vike-mail; neither
// of those depends on this (the universal-orm-rudder adapter pattern).
//
// Importing this module self-registers the channel — install the package and
// `via: ['mail']` works. `registerMailChannel()` is also exported for explicit or
// repeat registration (e.g. tests, which clear the registry between cases).
import { registerChannel, routeFor } from 'vike-notifications'
import { sendMail } from 'vike-mail'

// The channel contract: { name, send(notifiable, rendered) }. `rendered` is the
// notification's toMail(user) output — the message CONTENT (subject / html / text). The
// RECIPIENT comes from the notifiable via routeFor, NOT from `rendered.to`, so routing
// stays the adapter's job and a future non-User notifiable is handled in one place (#206).
// routeFor's `to` is applied AFTER the spread, so it always wins over any `to` the
// notification happened to render.
export const mailChannel = {
  name: 'mail',
  async send(notifiable, rendered) {
    return sendMail({ ...rendered, to: routeFor(notifiable, 'mail') })
  },
}

/** Register the mail channel into vike-notifications (idempotent — last registration wins). */
export function registerMailChannel() {
  return registerChannel(mailChannel)
}

// Self-register on import.
registerMailChannel()

export default registerMailChannel
