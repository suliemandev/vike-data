# vike-notifications-push

The **push channel adapter** for [`vike-notifications`](../vike-notifications). It registers a `push` channel that delivers a notification's `toPush()` through [`vike-push`](../vike-push)'s `sendPush`.

It's a separate package on purpose: the notifications core is **closed for modification**, so adding a channel is a new adapter package like this one, never an edit to `vike-notifications`. It depends on both `vike-notifications` and `vike-push`; neither of those depends on it.

## Usage

```js
// server start: install the channel (importing the package self-registers it)
import 'vike-notifications-push'
// or explicitly:
import { registerPushChannel } from 'vike-notifications-push'
registerPushChannel()
```

Then any notification whose `via()` includes `'push'` is delivered by Web Push:

```js
import { notify } from 'vike-notifications'
await notify(user, paymentFailed(invoice)) // via: ['push', 'database'] -> a push + a feed row
```

## How it routes

The notification's `toPush(user)` returns the push **payload** (`title` / `body` / ...). The **target** is the user id resolved from the notifiable via the core's `routeFor` (today: `notifiable.id`) — push is user-based, so `vike-push` looks up that user's stored subscriptions and delivers one job per subscription. Routing the target via `routeFor` (not `notifiable.id` inline) keeps a future non-User notifiable a one-place change (see #206).

```js
const pushChannel = {
  name: 'push',
  async send(notifiable, rendered) {
    return sendPush(routeFor(notifiable, 'push'), rendered)
  },
}
```

The subscriptions, the queue fan-out (one job per subscription) and the dev console/outbox transport are all `vike-push`'s — this adapter only bridges the notification to it. A user with no subscriptions is a no-op.
