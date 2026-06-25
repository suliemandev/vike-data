# vike-notifications-mail

The **mail channel adapter** for [`vike-notifications`](../vike-notifications). It registers a `mail` channel that delivers a notification's `toMail()` through [`vike-mail`](../vike-mail)'s `sendMail`.

It's a separate package on purpose: the notifications core is **closed for modification**, so adding a channel is a new adapter package like this one, never an edit to `vike-notifications`. It depends on both `vike-notifications` and `vike-mail`; neither of those depends on it.

## Usage

```js
// server start: install the channel (importing the package self-registers it)
import 'vike-notifications-mail'
// or explicitly:
import { registerMailChannel } from 'vike-notifications-mail'
registerMailChannel()
```

Then any notification whose `via()` includes `'mail'` is delivered by email:

```js
import { notify } from 'vike-notifications'
await notify(user, paymentFailed(invoice)) // via: ['mail', 'database'] -> an email + a feed row
```

## How it routes

The notification's `toMail(user)` returns the message **content** (`subject` / `html` / `text`). The **recipient** is resolved from the notifiable via the core's `routeFor` (today: `notifiable.email`), not from `rendered.to` — routing is the adapter's job, so a future non-User notifiable is handled in one place (see #206). A `to` the notification happens to render is overridden by the routed address.

```js
const mailChannel = {
  name: 'mail',
  async send(notifiable, rendered) {
    return sendMail({ ...rendered, to: routeFor(notifiable, 'mail') })
  },
}
```

Delivery, retries and the dev console/outbox transport are all `vike-mail`'s — this adapter only bridges the notification to it.
