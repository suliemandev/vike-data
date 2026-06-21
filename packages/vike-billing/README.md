# vike-billing

Billing / subscriptions extension, and the **third leg** of the
[vike-data](../../README.md) composition proof: it composes on top of
[vike-auth](../vike-auth/README.md) and/or [vike-teams](../vike-teams/README.md),
proving the schema layer holds up as the SaaS spine grows past two extensions.

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
with the merged config, so the FK follows `billingSubject`:

| `billingSubject` | `subscriptions` FK                     |
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

## Table

`subscriptions`: id, `<subject>_id` (FK), plan, status, seats, stripe_customer_id,
current_period_end, timestamps.

## Roadmap note

This is a flat `subscriptions` table — the minimal shape. The vike-dashboard
reference models billing as an **event-sourced** `event__*` (append-only) +
`computed__*` (rebuildable projection) split, with an entitlements projection
spanning all purchases. That is the natural next layer here, and it is also where
vike-data's schema model would next be pressured (append-only event tables +
derived projections as first-class shapes).
