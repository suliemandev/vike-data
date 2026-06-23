// vike-rudder end-to-end (#75): installing vike-rudder makes an extension write to a real
// Rudder database. We register a NativeAdapter via the binding, then drive vike-stripe's wired
// instance and assert the row landed — sqlite in-memory (no server/network). Own test file so
// the lazy globalThis instances (the registry + vike-stripe) are fresh in this process.
import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { NativeAdapter } from '@rudderjs/database/native'
import { getAdapter, clearAdapter } from '@universal-orm/core'
import { registerRudder } from '../index.js'

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
  // What the app's +onCreateGlobalContext.js does at server start: register the Rudder
  // connection as the universal-orm adapter. Pass the ready NativeAdapter (the instanceof path).
  await registerRudder(native)
  // Imported AFTER registration so vike-stripe's lazy build resolves the Rudder adapter.
  ;({ subscriptions: subs } = await import('../../vike-stripe/subscription/instance.js'))
})

after(async () => {
  await native.disconnect()
})

beforeEach(async () => {
  await native.affectingStatement('DELETE FROM subscriptions', [])
})

test('the binding registers a Rudder adapter on the shared registry', () => {
  const a = getAdapter()
  assert.ok(a && typeof a.upsert === 'function', 'expected a registered adapter')
})

test('vike-stripe writes to a real Rudder database through the installed binding', async () => {
  const res = await subs.applySubscriptionEvent({ subject: ORG, plan: 'pro', status: 'active', seats: 4 })
  assert.equal(res.ok, true)

  const rows = await native.query('subscriptions').get()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].organization_id, ORG)
  assert.equal(rows[0].plan, 'pro')
  assert.equal(rows[0].seats, 4)
  assert.ok(rows[0].id, 'DB generated the primary key')
})

test('registration is idempotent (first wins), so duplicate hook eval cannot fork it', async () => {
  const current = getAdapter()
  await registerRudder(native) // second call
  assert.equal(getAdapter(), current)
})

test('registerRudder builds a NativeAdapter from a { driver, url } config', async () => {
  // The other entry shape: hand it a config instead of a ready adapter. Cleared first so it
  // actually builds (first-wins would otherwise short-circuit). Runs last so it does not
  // disturb the shared instance above.
  clearAdapter()
  const a = await registerRudder({ driver: 'sqlite', url: ':memory:' })
  assert.ok(a && typeof a.upsert === 'function', 'built and registered an adapter from config')
})
