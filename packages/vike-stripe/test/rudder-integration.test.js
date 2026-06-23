// The end-to-end proof for #75: the app registers `@universal-orm/rudder`, and vike-stripe's
// wired instance INSERTs/UPSERTs for real against a Rudder database — asserted by reading the
// DB back. The database is in-memory sqlite via `@rudderjs/database` NativeAdapter (no server,
// no network), the same backend the rudder adapter's own tests use. This proves the third
// Rudder package through a real extension, not just in isolation — the twin of
// drizzle-integration.test.js.
//
// Own test file so the lazy globalThis instance is built fresh in this process, after the
// Rudder adapter is registered.
import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { NativeAdapter } from '@rudderjs/database/native'
import { setAdapter } from '@universal-orm/core'
import { createRudderAdapter } from '@universal-orm/rudder'

// sqlite has no uuid / gen_random_uuid, so the PK is an autoincrement integer the DB fills
// (applySubscriptionEvent supplies no id); organization_id is the unique subject the upsert
// keys on. Columns are the subscriptions schema, in sqlite types.
const CREATE = `
  CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id TEXT UNIQUE,
    plan TEXT,
    status TEXT,
    seats INTEGER,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    current_period_end TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  )`

const ORG = 'org-00000001'

let native
let subs

before(async () => {
  native = await NativeAdapter.make({ driver: 'sqlite', url: ':memory:' })
  await native.affectingStatement(CREATE, [])
  // The app's one line: install the Rudder adapter and hand it the connection.
  setAdapter(createRudderAdapter(native))
  // Imported AFTER setAdapter so the lazy build resolves the Rudder adapter.
  ;({ subscriptions: subs } = await import('../subscription/instance.js'))
})

after(async () => {
  await native.disconnect()
})

beforeEach(async () => {
  await native.affectingStatement('DELETE FROM subscriptions', [])
})

test('an extension event INSERTs a real row through @universal-orm/rudder', async () => {
  const res = await subs.applySubscriptionEvent({ subject: ORG, plan: 'pro', status: 'active', seats: 3 })
  assert.equal(res.ok, true)

  const rows = await native.query('subscriptions').get()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].organization_id, ORG)
  assert.equal(rows[0].plan, 'pro')
  assert.equal(rows[0].seats, 3)
  assert.ok(rows[0].id, 'DB generated the primary key')
})

test('repeated events UPSERT one real row (converge), keyed by the subject FK', async () => {
  await subs.applySubscriptionEvent({ subject: ORG, plan: 'pro', status: 'active', seats: 1 })
  await subs.applySubscriptionEvent({ subject: ORG, plan: 'enterprise', status: 'canceled', seats: 25 })

  const rows = await native.query('subscriptions').get()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].plan, 'enterprise')
  assert.equal(rows[0].status, 'canceled')
  assert.equal(rows[0].seats, 25)
})
