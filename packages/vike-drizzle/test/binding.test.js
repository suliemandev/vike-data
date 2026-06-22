// vike-drizzle end-to-end (#70): installing vike-drizzle makes an extension write
// to a real database. We register a Drizzle connection via the binding, then drive
// vike-stripe's wired instance and assert the row landed in Postgres (PGlite,
// in-process — no server/network). Own test file so the lazy globalThis instances
// (the registry + vike-stripe) are fresh in this process.

import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { getAdapter } from '@universal-orm/core'
import { registerDrizzle } from '../index.js'

// The generated-schema shape for the subscriptions table (timestamps in mode:'string'
// per #68, matching universal-orm's ISO strings).
const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').unique(),
  plan: varchar('plan', { length: 255 }),
  status: varchar('status', { length: 255 }),
  seats: integer('seats'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
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
  // What the app's +onCreateGlobalContext.js does at server start: register the
  // Drizzle connection as the universal-orm adapter.
  registerDrizzle(drizzle(client), { subscriptions })
  // Imported AFTER registration so vike-stripe's lazy build resolves the Drizzle
  // adapter. instance.js is internal (not a package export), so import by path.
  ;({ subscriptions: subs } = await import('../../vike-stripe/subscription/instance.js'))
})

beforeEach(async () => {
  await client.exec('truncate table subscriptions;')
})

test('the binding registers a Drizzle adapter on the shared registry', () => {
  const a = getAdapter()
  assert.ok(a && typeof a.upsert === 'function', 'expected a registered adapter')
})

test('vike-stripe writes to real Postgres through the installed binding', async () => {
  const res = await subs.applySubscriptionEvent({ subject: ORG, plan: 'pro', status: 'active', seats: 4 })
  assert.equal(res.ok, true)

  const { rows } = await client.query('select * from subscriptions')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].organization_id, ORG)
  assert.equal(rows[0].plan, 'pro')
  assert.equal(rows[0].seats, 4)
  assert.ok(rows[0].id, 'DB generated the primary key')
})

test('registration is idempotent (first wins), so duplicate hook eval cannot fork it', () => {
  const before = getAdapter()
  registerDrizzle(drizzle(client), { subscriptions }) // second call
  assert.equal(getAdapter(), before)
})
