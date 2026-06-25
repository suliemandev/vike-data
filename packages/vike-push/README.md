# vike-push

The Web Push channel: `sendPush(userId, payload)` over stored subscriptions, a swappable push transport, and a subscribe endpoint. The second channel after `vike-mail`, sending through `vike-queue`. Push is user-targeted and stateful: a user must subscribe first (browser permission + a stored PushManager subscription).

This package ships the server side (the port, the `push_subscriptions` table, the `/push/*` endpoint), the client side (a service worker + a subscribe control for React and Vue), and a real Web Push / VAPID transport at `vike-push/web-push`. The dev console/outbox transport proves the channel with zero config.

## Usage

```js
// a producer: send to a user across all their subscriptions
import { sendPush } from 'vike-push'
await sendPush(user.id, { title: 'New invite', body: 'You were added to Acme' })
```

```js
// the app: register the transport once at server start
import { setPushTransport } from 'vike-push'
import { webPushTransport } from 'vike-push/web-push'
setPushTransport(webPushTransport({
  subject: 'mailto:ops@acme.com',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
}))
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

## Client: the subscribe control

A user must opt in (browser permission + a stored subscription) before `sendPush` can reach them. vike-push ships that flow:

```jsx
// React
import { PushToggle } from 'vike-push/react/PushToggle'
<PushToggle />   // Enable / Disable notifications

// Vue
import PushToggle from 'vike-push/vue/PushToggle'
<PushToggle />
```

The control reads the VAPID public key from the app's `vapidPublicKey` config (off `pageContext`), registers the service worker, subscribes via `PushManager`, and POSTs the subscription to `/push/subscribe`. The framework-agnostic helpers are at `vike-push/client` (`subscribe`, `unsubscribe`, `isPushSupported`); the controls are thin wrappers, and none of them import the server module.

### Service worker (the #154 question, resolved)

A service worker controls pages under its own path scope, so it must be served from the app origin at the root. vike-push ships the canonical worker at `vike-push/sw`; the app serves it by placing a copy at `public/vike-push-sw.js` (Vike serves `public/` at the root), the eject-style ownership the repo prefers. The control registers `/vike-push-sw.js` by default (override with the `swUrl` prop).

### VAPID keys (the #154 question, resolved)

The app supplies the VAPID keypair. The public key reaches the client through the `vapidPublicKey` config (declared in `vike-push/config`, available client-side), which the control hands to `PushManager` as the `applicationServerKey`. The private key stays server-side in the push transport and is never exposed. Generate a keypair with `web-push generateVAPIDKeys` (or any P-256 generator).

## Web Push / VAPID transport

The production transport, an opt-in subpath so nothing Web Push specific is pulled into the neutral port unless the app asks for it. Server-only (it carries the VAPID private key), and zero runtime dependency: all crypto is Node's built-in WebCrypto.

```js
import { setPushTransport } from 'vike-push'
import { webPushTransport } from 'vike-push/web-push'

setPushTransport(webPushTransport({
  subject: 'mailto:ops@acme.com',          // VAPID `sub`: a mailto: or https URL (required)
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,   // the same key the client subscribes with
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY, // base64url 32-byte scalar, server-side only
  ttl: 86400,                              // optional push-service TTL header, seconds
}))
```

It encrypts the payload (RFC 8291, the aes128gcm encoding of RFC 8188), signs a VAPID JWT (RFC 8292, ES256), and POSTs to the subscription's endpoint. The encryption is verified against the RFC 8291 Appendix A test vector. It throws on a non-2xx, so `vike-queue` retries per the send job's `maxAttempts`; a `404`/`410` means the subscription has expired (pruning the row is a sensible follow-up). `fetch` is injectable for testing.

## Transport contract

```js
const transport = {
  async send({ endpoint, keys }, payload) { /* VAPID-sign + POST to the push service */ },
}
```
