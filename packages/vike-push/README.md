# vike-push

The Web Push channel: `sendPush(userId, payload)` over stored subscriptions, a swappable push transport, and a subscribe endpoint. The second channel after `vike-mail`, sending through `vike-queue`. Push is user-targeted and stateful: a user must subscribe first (browser permission + a stored PushManager subscription).

> This package currently ships the server side (the port, the `push_subscriptions` table, and the `/push/*` endpoint). The per-framework client control + service worker (`vike-push/react`, `vike-push/vue`) and a real Web Push / VAPID transport are the next chunk (see the tracking issue).

## Usage

```js
// a producer: send to a user across all their subscriptions
import { sendPush } from 'vike-push'
await sendPush(user.id, { title: 'New invite', body: 'You were added to Acme' })
```

```js
// the app: register the transport once at server start
import { setPushTransport } from 'vike-push'
setPushTransport(myWebPushTransport) // { send(subscription, payload) -> Promise }
```

`sendPush` looks up the user's stored subscriptions and dispatches one `vike-queue` job per subscription, so one bad endpoint does not block the others.

## Zero-config default

With no transport registered, a built-in console/outbox transport records each delivery (`getPushOutbox()`) and logs a one-liner, so the channel is provable without real Web Push crypto. An app upgrades by calling `setPushTransport` with a VAPID-signing transport.

## Subscriptions

`vike-push` owns the `push_subscriptions` table (FK to `users`) and the endpoint that fills it:

| route | method | does |
|---|---|---|
| `/push/subscribe`   | POST | store a `{ endpoint, keys }` subscription, bound to the signed-in user (keyed by `endpoint`, so re-subscribing refreshes the row) |
| `/push/unsubscribe` | POST | remove a subscription by `{ endpoint }` |

Both resolve the current user from the session cookie (vike-auth's server seam), so a client can only manage its own subscriptions. `saveSubscription` / `removeSubscription` are also exported for programmatic use.

## Transport contract

```js
const transport = {
  async send({ endpoint, keys }, payload) { /* VAPID-sign + POST to the push service */ },
}
```
