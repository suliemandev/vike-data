// vike-billing contributes a COMPUTED schema: a function of the resolved config.
// Two things matter and are pinned here: (1) the billingSubject option re-points
// the FK (B2B organizations vs per-seat users) — the whole reason it's computed;
// (2) the event-sourced shape (append-only event log + one-to-one projection).
// A final cross-check merges the output against users/organizations stubs to
// prove the computed FKs actually resolve.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema, mergeSchemas, deriveRelations } from '@vike-data/vike-schema/schema'
import billingSchemas from '../schemas.js'

const tableOf = (frags, name) => frags.find((f) => f.table === name)
const colOf = (frag, name) => frag.columns.find((c) => c.name === name)

test('contributes exactly the event log + projection tables, both creates', () => {
  const frags = billingSchemas({})
  assert.deepEqual(
    frags.map((f) => [f.mode, f.table]),
    [
      ['create', 'event__subscription_events'],
      ['create', 'computed__subscriptions'],
    ],
  )
})

test('defaults billingSubject to organization (B2B) — FK targets organizations', () => {
  for (const cfg of [undefined, {}, { billingSubject: 'organization' }, { billingSubject: 'bogus' }]) {
    const frags = billingSchemas(cfg)
    const ref = colOf(tableOf(frags, 'computed__subscriptions'), 'organization_id')
    assert.ok(ref, `expected organization_id for config ${JSON.stringify(cfg)}`)
    assert.deepEqual(ref.references, { table: 'organizations', column: 'id' })
  }
})

test('billingSubject "user" re-points both FKs at users.id', () => {
  const frags = billingSchemas({ billingSubject: 'user' })
  for (const tableName of ['event__subscription_events', 'computed__subscriptions']) {
    const ref = colOf(tableOf(frags, tableName), 'user_id')
    assert.ok(ref, `expected user_id on ${tableName}`)
    assert.deepEqual(ref.references, { table: 'users', column: 'id' })
    assert.equal(colOf(tableOf(frags, tableName), 'organization_id'), undefined)
  }
})

test('the event table is append-only: created_at but no updated_at', () => {
  const events = tableOf(billingSchemas({}), 'event__subscription_events')
  assert.ok(colOf(events, 'created_at'))
  assert.equal(colOf(events, 'updated_at'), undefined)
})

test('stripe_event_id is unique (webhook replay idempotency key)', () => {
  const events = tableOf(billingSchemas({}), 'event__subscription_events')
  assert.equal(colOf(events, 'stripe_event_id').unique, true)
})

test('the projection keys one-per-subject (unique FK) and tracks rebuild time', () => {
  const proj = tableOf(billingSchemas({}), 'computed__subscriptions')
  assert.equal(colOf(proj, 'organization_id').unique, true) // one-to-one
  assert.ok(colOf(proj, 'updated_at')) // last projection rebuild
})

// ----------------------------------------------------- cross-package merge ----

const subjectTables = () => [
  defineSchema('users', (t) => t.uuid('id').primary()),
  defineSchema('organizations', (t) => t.uuid('id').primary()),
]

test('billing FKs resolve cleanly when merged with users/organizations (default)', () => {
  const { conflicts } = mergeSchemas([...subjectTables(), ...billingSchemas({})])
  assert.deepEqual(conflicts, [])
})

test('billing FKs resolve cleanly under the per-user subject too', () => {
  const { conflicts } = mergeSchemas([...subjectTables(), ...billingSchemas({ billingSubject: 'user' })])
  assert.deepEqual(conflicts, [])
})

test('the projection FK derives a one-to-one relation', () => {
  const { tables } = mergeSchemas([...subjectTables(), ...billingSchemas({})])
  const rels = deriveRelations(tables)
  const fwd = rels.get('computed__subscriptions').forward.find((r) => r.target === 'organizations')
  assert.equal(fwd.toOne, true)
})
