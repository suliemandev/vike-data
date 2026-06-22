// The end-to-end proof for #66: the app registers `@universal-orm/drizzle`, and
// vike-stripe's wired instance INSERTs/UPSERTs for real against Postgres — asserted
// by querying the DB directly. Postgres is PGlite (in-process, no server/network),
// the same backend the drizzle adapter's own tests use. This is what makes the third
// package proven THROUGH a real extension, not just in isolation.
//
// Own test file so the lazy globalThis instance is built fresh in this process,
// after the Drizzle adapter is registered.

import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { setAdapter } from '@universal-orm/core'
import { createDrizzleAdapter } from '@universal-orm/drizzle'

// camelCase property keys, snake_case DB columns — the real generated-schema shape,
// matching subscription/schemas.js (b2b default: organization_id is the subject FK).
const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').unique(),
  plan: varchar('plan', { length: 255 }),
  status: varchar('status', { length: 255 }),
  seats: integer('seats'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
  // mode: 'string' — universal-orm speaks ISO strings (its isoNow()), the same the
  // memory adapter stores, so the generated Drizzle schema must too.
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
})

const CREATE_SQL = `
  create table subscriptions (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid unique,
    plan varchar(255),
    status varchar(255),
    seats integer,
    stripe_customer_id varchar(255),
    stripe_subscription_id varchar(255) unique,
    current_period_end timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz
  );`

const ORG = '00000000-0000-0000-0000-000000000001'

let client
let subs

before(async () => {
  client = new PGlite()
  await client.exec(CREATE_SQL)
  // The app's one line: install the Drizzle adapter and hand it the connection.
  setAdapter(createDrizzleAdapter(drizzle(client), [subscriptions]))
  // Imported AFTER setAdapter so the lazy build resolves the Drizzle adapter.
  ;({ subscriptions: subs } = await import('../subscription/instance.js'))
})

beforeEach(async () => {
  await client.exec('truncate table subscriptions;')
})

test('an extension event INSERTs a real row through @universal-orm/drizzle', async () => {
  const res = await subs.applySubscriptionEvent({ subject: ORG, plan: 'pro', status: 'active', seats: 3 })
  assert.equal(res.ok, true)

  const { rows } = await client.query('select * from subscriptions')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].organization_id, ORG)
  assert.equal(rows[0].plan, 'pro')
  assert.equal(rows[0].seats, 3)
  assert.ok(rows[0].id, 'DB generated the primary key')
})

test('repeated events UPSERT one real row (converge), keyed by the subject FK', async () => {
  await subs.applySubscriptionEvent({ subject: ORG, plan: 'pro', status: 'active', seats: 1 })
  await subs.applySubscriptionEvent({ subject: ORG, plan: 'enterprise', status: 'canceled', seats: 25 })

  const { rows } = await client.query('select * from subscriptions')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].plan, 'enterprise')
  assert.equal(rows[0].status, 'canceled')
  assert.equal(rows[0].seats, 25)
})
