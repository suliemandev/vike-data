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
import subscription from 'vike-stripe/subscription' // recurring subscriptions
import purchase from 'vike-stripe/purchase'         // one-time charges

export default {
  extends: [subscription /* and/or */, purchase],
  segment: 'b2b', // who is billed: 'b2b' (organization, default) or 'b2c' (user)
}
```

The subpath picks the **model** (recurring vs one-time); `segment` picks **who** you
bill. The two axes are orthogonal, so model x segment covers all four combinations.

| subpath | model | table | the write |
|---|---|---|---|
| `vike-stripe/subscription` | recurring subscription, one row per subject | `subscriptions` (unique subject FK) | **upsert** keyed by subject |
| `vike-stripe/purchase` | one-time charges, many per subject | `payments` (non-unique subject FK) | **insert**, idempotent per payment-intent |

Both follow `segment` (`b2b` targets the `organizations` FK, `b2c` the `users` FK), self-install
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
POST /stripe/purchase/webhook      -> db.payments.insert(row)   (idempotent per intent)
```

The webhook verifies the Stripe signature over the RAW request body **before any
write** (a forged or unsigned request is a `400` and never reaches the core), then
calls a framework- and ORM-agnostic core (`subscription.js` / `payment.js`) that does
a single universal-orm call. The write routes through **the adapter the app registered** (`setAdapter` in
`@universal-orm/core`): a real app installs `@universal-orm/drizzle` once at server
start and the webhook writes to Postgres for real; with nothing registered it falls
back to the in-process **memory adapter** (the zero-config proof and demo). The core
is unchanged either way — that round trip is proven on Postgres (PGlite) in
`test/drizzle-integration.test.js`.

- **subscription** is the canonical **upsert**: the same subject emits repeated
  events (`created → renewed → canceled`), each converging the one row. Stripe does
  not guarantee ordering and retries deliveries, so an event carrying `occurredAt`
  older than the stored row is **dropped as stale** — a delayed `active` event can't
  overwrite a newer `canceled` one and re-grant access.
- **purchase** is the narrowest **insert**: a charge is immutable, so there is
  nothing to upsert. Only a **succeeded** charge is recorded (a `payment_intent.payment_failed`
  / refunded / pending event is ignored with a 200, never a `payments` row), and
  `paymentsFor` returns only succeeded rows. Idempotency is keyed on the unique Stripe
  payment-intent id: a `findOne` fast-path plus a caught unique-violation on insert, so a
  concurrent duplicate delivery returns the existing row instead of a 500.

No transactions yet (each write is a single atomic statement; idempotency leans on the
`stripe_payment_intent_id` unique constraint).

> The webhook verifies the `stripe-signature` header over the raw body (a shared
> `constructEvent` in `stripe.js`, the single place a signature gates a write) before
> the core runs, so an extension INSERTs/upserts for real, ORM-agnostically, only on a
> genuinely-signed event.

## Parameterized, the idiomatic way

Each model declares `segment` and **computes** its schema from it (a function wired as
a pointer-import, since a runtime config value can't be an inline function), so the
subject FK lands in `organizations` (`b2b`) or `users` (`b2c`). That needs no vike-data
core change — it is the normal Vike options pattern plus a computed schema
contribution. `BILLING_SEGMENT` switches it in the demo.

### Following a renamed subject

vike-stripe deliberately does **not** import `vike-auth` / `vike-teams` — billing
stays decoupled. So if an app renames the subject table (vike-auth's
`VIKE_AUTH_SUBJECT_TABLE`, or vike-teams' `VIKE_TEAMS_ORGANIZATIONS_TABLE`), stripe
can't resolve that itself. Pass the resolved table name through the optional
`subjectTable` config; the FK **column** stays segment-derived
(`user_id` / `organization_id`), only its **target table** follows:

```js
import subscription from 'vike-stripe/subscription'
import { resolveSubject } from 'vike-auth/subject'

export default {
  extends: [subscription],
  segment: 'b2c',
  subjectTable: resolveSubject().users, // b2c -> the (possibly renamed) auth table
}
```

Unset = the segment default (`users` / `organizations`), byte-for-byte today. The
coupling to auth/teams lives in the **app**, not in vike-stripe.
