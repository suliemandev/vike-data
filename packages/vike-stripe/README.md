# vike-stripe

Stripe billing as composable Vike extensions, and the **universal-orm proof**: each
billing model writes for real through [universal-orm](../universal-orm/README.md) —
**no ORM import anywhere in the extension**.

## One package, billing models as subpaths

vike-stripe is a single package; each billing model is a **subpath implementation**,
so you install only the one(s) you want (the subpath default export *is* the config —
no `/config`):

```js
// pages/+config.js
import subscriptions from 'vike-stripe/b2c-subscription' // recurring subscriptions
import payments from 'vike-stripe/b2b-payment'          // one-time charges

export default {
  extends: [subscriptions /* and/or */, payments],
  billingSubject: 'organization', // who is billed: 'organization' (default) or 'user'
}
```

| subpath | model | table | the write |
|---|---|---|---|
| `vike-stripe/b2c-subscription` | recurring subscription, one row per subject | `subscriptions` (unique subject FK) | **upsert** keyed by subject |
| `vike-stripe/b2b-payment` | one-time charges, many per subject | `payments` (non-unique subject FK) | **insert**, idempotent per payment-intent |

Both follow `billingSubject` (the FK targets `organizations` or `users`), self-install
vike-teams (so `users` + `organizations` exist), and contribute a server tier whose
webhook does the write through universal-orm. They are independent Lego pieces:
install either, or both.

> **Provider name.** Stripe is the baked-in default (a known brand, and the shared
> Stripe SDK lives in one place — [`stripe.js`](./stripe.js)). Another provider is its
> own package, `vike-paddle`, with the same subpath shape: a provider is a *swap*, not
> additive. A thin provider-neutral layer (swap Stripe→Paddle without rewriting) is a
> seam we keep in mind but do not build yet.

## The server tier (how an extension INSERTs)

```
POST /stripe/subscription/webhook  -> db.subscriptions.upsert(row, { onConflict })
POST /stripe/payment/webhook       -> db.payments.insert(row)   (idempotent per intent)
```

The webhook parses the event via the shared Stripe SDK, then calls a framework- and
ORM-agnostic core (`subscription.js` / `payment.js`) that does a single universal-orm
call. The default wiring runs on the **memory adapter** (no database, for the proof
and the demo); a real app passes a `db` built from `@universal-orm/drizzle` and its
merged schema, and the core is unchanged.

- **b2c-subscription** is the canonical **upsert**: the same subject emits repeated
  events (`created → renewed → canceled`), each converging the one row.
- **b2b-payment** is the narrowest **insert**: a charge is immutable, so there is
  nothing to upsert; idempotency is a `findOne` on the Stripe payment-intent id before
  the insert.

No transactions yet (each write is a single atomic statement).

> In the proof the webhook is a plain JSON POST — no Stripe signature verification,
> which is a provider concern for a real vike-stripe. The point is to watch an
> extension INSERT/upsert for real, ORM-agnostically.

## Parameterized, the idiomatic way

Each model declares `billingSubject` and **computes** its schema from it (a function
wired as a pointer-import, since a runtime config value can't be an inline function),
so the subject FK lands in `organizations` (default) or `users`. That needs no
vike-data core change — it is the normal Vike options pattern plus a computed schema
contribution. `BILLING_SUBJECT` switches it in the demo.
