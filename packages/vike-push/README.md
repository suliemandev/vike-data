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

**Endpoints are device-scoped (trust model).** A push `endpoint` identifies a service-worker registration on one browser profile, not a user. So when the same browser re-subscribes under a different account (logout/login on a shared device), `/push/subscribe` re-binds that endpoint to the current signed-in user and rotates the keys — the prior user *should* stop receiving pushes on a device they left. This is intended, and is not the IDOR the owner-scoped `/push/unsubscribe` guards against: the endpoint URL is a bearer capability, and an attacker who already knows another user's secret endpoint can at most cause a self-healing denial (that user re-subscribes routinely) and never reads their pushes (they decrypt only with their own browser's keys). Clients should call `PushSubscription.unsubscribe()` on logout to release the endpoint promptly.

## Owned by a team, not a user (`pushOwner`, #250)

By default a subscription is owned by the auth user. `pushOwner` lets it belong to an **organization** instead, so `sendPush(orgId, …)` reaches every member's device — one announcement to the whole team. The same move [vike-stripe's `segment`](../vike-stripe/README.md) makes, lifted into the shared [`@vike-data/kit`](../kit) `resolveOwner` contract [vike-storage](../vike-storage/README.md) and [vike-notifications](../vike-notifications/README.md) use too.

With [vike-teams](../vike-teams) supplying `organizations` (and stamping each user's active org onto `current_organization_id`):

```js
// +config.js — build-time: the push_subscriptions FK becomes organization_id -> organizations.id
pushOwner: { table: 'organizations', column: 'organization_id' },
```
```bash
# runtime, two halves:
VIKE_PUSH_OWNER_COLUMN=organization_id          # the column subscriptions are written/scoped by
VIKE_PUSH_OWNER_FROM=current_organization_id    # which field of the signed-in user holds the owner id
```

`/push/subscribe` is still authenticated as the signed-in user; the subscription's **owner** is then their `current_organization_id`, so every member's device is registered under the org and `sendPush(orgId, …)` fans out to all of them. A signed-in user who belongs to no org gets `403 no-owner`. Leave `pushOwner` unset and subscriptions stay the single-user default, byte-for-byte. vike-push never imports vike-teams — the app names the table/column/source field.

> Unlike vike-storage/vike-notifications, vike-push has no `*Guard` (named-guard) axis yet; it resolves against the default subject. Adding that axis is tracked separately.

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

It encrypts the payload (RFC 8291, the aes128gcm encoding of RFC 8188), signs a VAPID JWT (RFC 8292, ES256), and POSTs to the subscription's endpoint. The encryption is verified against the RFC 8291 Appendix A test vector. A transient non-2xx (e.g. `500`/`429`) throws, so `vike-queue` retries per the send job's `maxAttempts`. A `404`/`410` means the subscription is permanently gone (the browser unsubscribed or it expired): the transport flags the error `subscriptionGone`, and vike-push prunes the dead row instead of retrying. `fetch` is injectable for testing.

A custom transport can opt into the same pruning by throwing an error with `err.subscriptionGone = true` when its provider reports a subscription is permanently gone.

## Transport contract

```js
const transport = {
  async send({ endpoint, keys }, payload) { /* VAPID-sign + POST to the push service */ },
}
```
