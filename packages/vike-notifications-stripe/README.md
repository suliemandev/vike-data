# vike-notifications-stripe

The **billing → notifications bridge**. When a user subscription transitions into `past_due` (a failed payment), it notifies that user — *"your payment failed"* — through [`vike-notifications`](../vike-notifications), across whichever channels are registered (email + the in-app feed).

This is the first real multi-channel consumer that earns the notifications layer its place: the issue's discipline is *don't build the orchestrator before there is something to orchestrate*, and a failed subscription payment is that something.

## Dependency direction (the whole point)

It depends on **both** [`vike-stripe`](../vike-stripe) and `vike-notifications`; **neither of those depends on it** (AUTHORING §9 dependency inversion). `vike-stripe` only *emits* a subscription event; this bridge *subscribes* and reacts. So `vike-stripe` never imports notifications, and an app that doesn't want billing notifications simply doesn't install this package.

## Usage

```js
// server start
import 'vike-notifications-stripe'      // subscribe the bridge (self-registers on import)
import 'vike-notifications-mail'         // + whichever channels you want past_due to reach
```

That's it. A `past_due` subscription webhook now produces an email and an in-app feed entry for the affected user, with no app code.

## How it works

`vike-stripe`'s `applySubscriptionEvent` emits `{ subscription, previousStatus, subjectColumn, subjectId }` after each apply (the `vike-stripe/subscription/events` seam). This bridge observes it and, on the **transition** into `past_due` (not every `past_due` event — a replayed webhook must not re-notify) for a **user** subject, calls:

```js
notify(subscription.user_id, paymentFailed(subscription))
```

`paymentFailed` is a plain-object notification (`via` → `['mail', 'database']`, `toMail`, `toDatabase`). An org (b2b) subject is skipped here — an organization has no single inbox; notifying its members is a separate fan-out.
