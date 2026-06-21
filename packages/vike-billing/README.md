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
with the merged config, so both billing tables' subject FK follows `billingSubject`:

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

## Event-sourced shape

billing is modelled the way the [vike-dashboard](https://github.com/vikejs/vike-dashboard)
reference does it: an **append-only event log is the source of truth**, and the
current state is a **rebuildable projection** over it.

| table | role | columns |
|---|---|---|
| `event__subscription_events` | append-only source of truth | id, `<subject>_id` (FK), type, plan, seats, **`stripe_event_id` (unique)**, occurred_at, created_at |
| `computed__subscriptions` | projection (folded from events) | id, `<subject>_id` (**unique** FK → 1:1), plan, status, seats, stripe_customer_id, current_period_end, updated_at |

The `event__` / `computed__` prefixes follow the dashboard's naming convention. An
event row is an immutable fact (`created` / `renewed` / `plan_changed` / `canceled`
/ `past_due`); `computed__subscriptions` is what you query, derived by folding the
events for a subject. The projection's subject FK is **unique** (one current
subscription per subject), which the relation graph reads as a one-to-one.

### Design note — what the schema IR can and can't express

Modelling this surfaced exactly where vike-data's neutral schema model is and isn't
enough. It is the genuine **design question for the Vike collaboration**: should
append-only + projection become first-class shapes in the IR?

**The IR expresses today (convention carries the rest):**

- **Idempotency** via `stripe_event_id` UNIQUE — replaying a Stripe webhook can't
  double-insert. This is a real, enforced constraint, not a convention.
- **Mutable flags** on a projection (e.g. `status`, `current_period_end`) — ordinary
  columns with defaults.
- **The 1:1 between a subject and its current projection** — a UNIQUE foreign key,
  which `deriveRelations` already turns into a one-to-one.
- **"This row is append-only" by omission** — the event table simply has no
  `updated_at` (and deliberately doesn't use the `timestamps()` helper, which adds
  one). That *documents* append-only; it doesn't *enforce* it.

**The IR can NOT express (gaps = the design note):**

1. **Append-only as a constraint.** Nothing stops an `UPDATE` / `DELETE` on
   `event__*`. Enforcing it is a database concern (revoke `UPDATE`/`DELETE`, or a
   trigger) that the IR has no vocabulary for. A first-class `defineEvent(...)` (or a
   table-level `.appendOnly()`) could carry that intent into each compiler.
2. **The projection → event derivation.** The IR has foreign keys, but no notion
   that `computed__subscriptions` *is a projection of* `event__subscription_events`.
   The relationship is naming-convention only; the fold/rebuild logic lives nowhere
   in the schema. A `defineProjection('subscriptions', { of: 'subscription_events' })`
   could at least record the dependency (and scaffold a rebuild).
3. **Event ordering / versioning / replay** — `occurred_at` vs `created_at` is the
   only ordering signal; there's no first-class sequence or aggregate version.
4. **`timestamps()` assumes mutable rows.** It always adds `updated_at`, which is
   wrong for an append-only table — a small ergonomics tell that the helper bakes in
   a CRUD assumption the event model breaks.

**Recommendation:** keep modelling event-sourcing with plain `defineSchema` + the
`event__` / `computed__` convention for now (it compiles to every ORM and the FK
checks hold). Treat append-only + projection as **candidate first-class shapes** to
discuss with Vike before adding IR surface — they only pay off if a compiler or the
runtime acts on them (enforce append-only; scaffold a projection rebuild). Adding
vocabulary the compilers ignore would be cost without payoff.
