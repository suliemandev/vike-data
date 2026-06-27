# vike-notifications

The multi-channel notifications layer: `notify(user, notification)` informs a user about one intent and fans it out to the channels they should hear it on (email, push, an in-app feed), per the notification's own `via()`. It sits **on top of** the channel packages (`vike-mail`, `vike-push`), not parallel to them: a channel adapter's `send()` ultimately calls that channel's own sender. The Laravel `Notification` value (one intent, many channels) for the Vike stack.

This is the **director** over the channels. Reach for it only when you have the multi-channel / fan-out case. A single transactional send (a magic link, a receipt) does not need it: call `sendMail` / `sendPush` directly.

This package is the neutral **core** and is **closed for modification** — adding a channel never edits it. It ships: `notify()`, a runtime channel registry, the built-in **database** channel, the owned `notifications` table, the session-scoped feed endpoint, and a per-framework bell. The concrete mail/push channels live in their own adapter packages (`vike-notifications-mail`, `vike-notifications-push`).

## Usage

```js
// a producer: inform a user, however they should be informed
import { notify } from 'vike-notifications'
await notify(user, paymentFailed(invoice))
```

A **notification** is a plain-object factory: a `via()` choosing channels, plus a `to<Channel>()` renderer per channel.

```js
export const paymentFailed = (invoice) => ({
  via: (user) => ['mail', 'database'],            // also 'push', or a custom channel
  toMail: (user) => ({ to: user.email, subject: 'Payment failed', html: render(invoice) }),
  toDatabase: (user) => ({ type: 'payment_failed', data: { title: 'Payment failed', body: invoice.number } }),
})
```

`notify()` resolves `via()` and dispatches **one `vike-queue` job per selected channel**, so one bad channel can't block the others. The first argument is the user row `{ id, email, ... }`; pass a bare user id and it is hydrated from the `users` table. Each channel reads the routing field it needs (mail by `.email`, push by `.id`).

A selected channel that is not registered (e.g. no mail adapter wired) is skipped, not an error — so the in-app feed always works even before the other channels are installed.

## Channels

A channel is `{ name, send(notifiable, rendered) }`, registered at runtime:

```js
import { registerChannel } from 'vike-notifications'
registerChannel({ name: 'mail', async send(user, rendered) { /* rendered = notification.toMail(user) */ } })
```

The built-in **`database`** channel is always registered (this package owns the table). Official mail/push adapters self-register from their own packages — `import 'vike-notifications-mail'` etc. — so adding a channel is a new package, never a change here.

**Adding your own channel.** `registerChannel` is the same seam whether a package or your app calls it, so the choice is about *distribution, not capability*: **package it** (a thin self-registering sibling like `vike-notifications-mail`) when the channel is reusable across apps; **app-wire it** — register a one-off `{ name, send }` directly at server start — for an app-specific channel you don't want to publish. The app-wired path is fully supported; see [AUTHORING §10](../../AUTHORING.md#10-runtime-registries-many-providers--the-app-wired-adapter) for a worked custom-channel (Slack) example.

## Who you notify

`notify(notifiable, …)` usually takes a **user** — a row `{ id, email, … }`, or a bare user id hydrated from the `users` table. Each channel resolves the address it delivers to through one seam, `routeFor(notifiable, channel)`: mail → `.email`, push → `.id`.

A notifiable can also carry an explicit **`routes`** map to override a channel, or to be routed with no stored user at all. `route({ … })` builds an **on-demand** target — useful for a guest-checkout receipt, a contact-form auto-reply, or an alert to an ops inbox, where there is no user row:

```js
import { notify, route } from 'vike-notifications'

await notify(route({ mail: 'guest@checkout.io' }), orderReceipt(order))
```

`routeFor` consults `routes[channel]` first, then falls back to the user-field convention, so an explicit route always wins for that one channel while the rest stay conventional (a User can carry `routes: { mail: billingAddress }` to send invoices somewhere other than `.email`). The route is plain **data**, not a method: the notifiable is serialized into the vike-queue delivery payload, so a method would not survive the queue — a data map does.

The in-app `database` **feed is user-scoped by default** (a feed only means something for a person's inbox), so an on-demand target simply uses the delivery channels — its notification's `via()` does not select `database`. To notify a group ad-hoc, resolve it to a list and `notify` per member (a fan-out over notifiables). To make the feed itself belong to an **organization** — one shared inbox every member reads — bind it with `notificationsOwner` (see [Owned by a team](#owned-by-a-team-not-a-user-notificationsowner-250) below), the single-owner-row alternative to fanning out.

## The in-app feed

`vike-notifications` owns the `notifications` table (FK to `users`, the Stem pattern) and a session-scoped endpoint:

| route | method | does |
|---|---|---|
| `/notifications`      | GET  | the signed-in user's feed (newest first) + unread count |
| `/notifications/read` | POST | mark `{ ids }` read, or all read when `ids` is omitted |

Both resolve the current user from the session cookie (vike-auth's server seam) and scope every read/write to that user, so a client only ever sees and marks its own. `getFeed` / `unreadCount` / `markRead` are also exported for programmatic use.

## Owned by a team, not a user (`notificationsOwner`, #250)

By default the feed is owned by the auth user. `notificationsOwner` is the orthogonal axis to `notificationsGuard` (which picks *which* user subject): it picks *what kind* of owner — let the feed belong to an **organization**, so every member shares one inbox. The same move [vike-stripe's `segment`](../vike-stripe/README.md) makes, lifted into the shared [`@vike-data/kit`](../kit) `resolveOwner` contract that [vike-storage](../vike-storage/README.md#owned-by-a-team-not-a-user-storageowner-250) uses too.

With [vike-teams](../vike-teams) supplying `organizations` (and stamping each user's active org onto `current_organization_id`):

```js
// +config.js — build-time: the notifications FK becomes organization_id -> organizations.id
notificationsOwner: { table: 'organizations', column: 'organization_id' },
```
```bash
# runtime, two halves:
VIKE_NOTIFICATIONS_OWNER_COLUMN=organization_id          # the column the feed is written/scoped by
VIKE_NOTIFICATIONS_OWNER_FROM=current_organization_id    # which field of the signed-in user holds it
```

The request is still authenticated as the signed-in user; the **owner** whose feed they read is then their `current_organization_id`, so the feed is owned by the org and any member reads + marks it. Notify the org by passing it as the notifiable (`notify({ id: orgId }, …)` with a `database` channel). A signed-in user who belongs to no org gets `403 no-owner`. Leave `notificationsOwner` unset and the feed stays the single-user default, byte-for-byte. vike-notifications never imports vike-teams — the app names the table/column/source field.

### The bell

```jsx
// React
import { NotificationsBell } from 'vike-notifications/react/Bell'
<NotificationsBell pollMs={30000} />

// Vue
import NotificationsBell from 'vike-notifications/vue/Bell'
<NotificationsBell :pollMs="30000" />
```

A bell with an unread badge that opens the feed and can mark everything read. The framework-agnostic client helpers are at `vike-notifications/client` (`fetchFeed`, `markRead`); the bells are thin wrappers and import nothing server-side. It is the app's own UI (mounted in the layout/nav), not a `vike-toolbar` item — the toolbar is strictly settings.

## When NOT to use this

Sending one thing through one channel does not need a notifications layer:

```js
import { sendMail } from 'vike-mail'
await sendMail({ to, subject, html })   // a magic link, a receipt — single channel, direct
```

`notify()` is the high-level intent that *uses* those low-level sends, the same way Laravel's `Notification::send()` sits on `Mail::send()`. Both exist; one is layered on the other.
