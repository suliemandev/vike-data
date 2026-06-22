# vike-billing

Billing / subscriptions extension, and the **third leg** of the
[vike-data](../../README.md) composition proof: it composes on top of
[vike-auth](../vike-auth/README.md) and/or [vike-teams](../vike-teams/README.md),
proving the schema layer holds up as the SaaS spine grows past two extensions. It
is also the **universal-orm proof**: its server tier writes for real, ORM-agnostic
(see [Server tier](#server-tier-the-universal-orm-proof)).

## A configurable extension (the idiomatic way)

vike-billing declares a config option, `billingSubject`, and the app sets it the
standard Vike way — as a sibling config key, exactly how vike-react takes `ssr` /
`prerender`:

```js
// pages/+config.js
import billingExt from 'vike-billing/config'

export default {
  extends: [billingExt],
  billingSubject: 'organization', // 'user' for per-seat / individual (default: organization)
}
```

billing's schema is **computed** from that option. Instead of a static
`schemas: [...]` array, billing contributes a *function* of the resolved config
(wired as a pointer-import, see [`schemas.js`](./schemas.js)); vike-schema calls it
with the merged config, so the subscription's subject FK follows `billingSubject`:

| `billingSubject` | subject FK                              |
|------------------|-----------------------------------------|
| `'organization'` | `organization_id` → `organizations.id`  |
| `'user'`         | `user_id` → `users.id`                  |

Either way it's a real, validated FK (`onDelete: cascade`). billing self-installs
vike-teams (which pulls auth + vike-schema), so both `users` and `organizations`
exist regardless of the subject:

```
vike-schema  <-  vike-auth  <-  vike-teams  <-  vike-billing
```

> **Finding (verified by spike).** A parameterized extension needs **no vike-data
> core change** and uses **no special Vike feature** — it's the normal options
> pattern (extension declares a config key via `meta`, app sets it) plus a
> *computed* contribution. A cumulative config value supplied via a `+file` /
> pointer-import arrives at the consumer as a **live function** and is called with
> the resolved config, so an extension can shape its schema from an app option. An
> *inline* function can't (Vike serializes runtime configs — it errors with
> `runtime-in-config`), which is why the function lives in `schemas.js`, wired in by
> pointer-import. The demo switches subject via `BILLING_SUBJECT` (mirroring
> `VIKE_DATA_ORM`).

## Plain mutable shape

billing is one ordinary, mutable row per subject:

| table | columns |
|---|---|
| `subscriptions` | id, `<subject>_id` (**unique** FK → 1:1), plan, status, seats, stripe_customer_id, stripe_subscription_id (unique), current_period_end, created_at, updated_at |

The subject FK is **unique** — one current subscription per subject, which the
relation graph reads as a one-to-one and which is exactly the upsert conflict key.

> **Design note — why not event-sourced?** An earlier cut modelled billing the way
> the [vike-dashboard](https://github.com/vikejs/vike-dashboard) reference does: an
> append-only `event__subscription_events` log as the source of truth, with a
> rebuildable `computed__subscriptions` projection folded over it. brillout's steer
> in the universal-orm thread was to **drop it**: most apps don't model billing as
> an immutable event stream, and it is odd if only the extension does. So billing is
> now a plain table you upsert — the shape a real app would actually reach for.
> Event-sourcing parks as a *candidate* first-class IR shape to discuss with Vike
> (append-only constraints, projection derivation) rather than something baked into
> every extension now; see the schema-IR question (#26). The schema IR is unchanged
> by this — it was always just `defineSchema`; only the chosen shape is simpler.

## Server tier (the universal-orm proof)

This is the live answer to *"how does an extension INSERT?"*. billing owns a webhook
endpoint and writes through [universal-orm](../universal-orm/README.md) — **no ORM
import anywhere in the extension**:

```
POST /stripe/webhook   { subject, plan, status, seats, ... }
  -> db.subscriptions.upsert(row, { onConflict: '<subject>_id' })
```

A Stripe subscription webhook is the canonical upsert case: the same subject emits
repeated events over time (`created` → `renewed` → `plan_changed` → `canceled`), and
each must converge the one subscription row. Keyed by the unique subject FK, that is
a single `upsert` — insert the first time, update in place after — so a replayed or
out-of-order webhook never doubles the row. No transaction needed (one upsert is
atomic on its own).

The pieces mirror vike-auth's server tier:

| file | role |
|---|---|
| [`billing.js`](./billing.js) | framework- and ORM-agnostic core: takes a universal-orm `db`, does `applySubscriptionEvent(event)` → `db.subscriptions.upsert(...)` |
| [`middleware.js`](./middleware.js) | universal middleware owning `POST /stripe/webhook`; a thin HTTP shell over the core |
| [`instance.js`](./instance.js) | the default wiring: a `db` over the **memory adapter** + the billing core, cached on `globalThis` |

The default instance runs on `@universal-orm/memory` (no database, for the proof and
the demo). A real app swaps in a `db` built from `@universal-orm/drizzle` and its
merged schema; the billing core does not change. That is the whole point — the
extension's write path is identical on any adapter.

> In the proof the "webhook" is a plain JSON POST — no Stripe signature
> verification, which is a provider concern for a real `vike-stripe`. The point is to
> watch an extension INSERT/upsert for real, ORM-agnostically.
