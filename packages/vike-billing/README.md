# vike-billing

Billing / subscriptions extension, and the **third leg** of the
[vike-data](../../README.md) composition proof: it composes on top of
[vike-auth](../vike-auth/README.md) and/or [vike-teams](../vike-teams/README.md),
proving the schema layer holds up as the SaaS spine grows past two extensions.

## A parameterized extension

Unlike vike-auth / vike-teams (static config objects), vike-billing is a config
**function** the app installs with an option that decides *what billing bills
against*:

```js
// pages/+config.js
import billing from 'vike-billing/config'

export default {
  extends: [billing({ subject: 'organization' })], // B2B (default)
  // extends: [billing({ subject: 'user' })],       // per-seat / individual
}
```

The option shapes both the contributed schema and the dependency chain:

| `subject`        | `subscriptions` FK                       | self-installs |
|------------------|-------------------------------------------|---------------|
| `'organization'` | `organization_id` → `organizations.id`    | vike-teams    |
| `'user'`         | `user_id` → `users.id`                     | vike-auth     |

Either way it's a real, validated foreign key (`onDelete: cascade`), and the whole
chain composes from one install:

```
vike-schema  <-  vike-auth  [<-  vike-teams]  <-  vike-billing
```

> **Finding:** this needs **no vike-data core change**. The contributed schema is
> just plain data built from the options, so an extension can be parameterized — in
> both its schema *and* its dependencies — and still compose. The demo app switches
> subject via the `BILLING_SUBJECT` env var (mirroring `VIKE_DATA_ORM`).

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
