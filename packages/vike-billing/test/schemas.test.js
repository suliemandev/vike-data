// vike-billing contributes a COMPUTED schema: a function of the resolved config.
// Two things matter and are pinned here: (1) the billingSubject option re-points
// the FK (B2B organizations vs per-seat users) — the whole reason it's computed;
// (2) the plain mutable `subscriptions` shape the webhook upserts (the old
// event-sourced log+projection was dropped, brillout's steer). A final cross-check
// merges the output against users/organizations stubs to prove the FK resolves.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema, mergeSchemas, deriveRelations } from '@vike-data/vike-schema/schema'
import billingSchemas from '../schemas.js'

const tableOf = (frags, name) => frags.find((f) => f.table === name)
const colOf = (frag, name) => frag.columns.find((c) => c.name === name)

test('contributes exactly one plain subscriptions table (create)', () => {
  const frags = billingSchemas({})
  assert.deepEqual(
    frags.map((f) => [f.mode, f.table]),
    [['create', 'subscriptions']],
  )
})

test('no event-sourced tables remain', () => {
  const frags = billingSchemas({})
  assert.equal(tableOf(frags, 'event__subscription_events'), undefined)
  assert.equal(tableOf(frags, 'computed__subscriptions'), undefined)
})

test('defaults billingSubject to organization (B2B) — FK targets organizations', () => {
  for (const cfg of [undefined, {}, { billingSubject: 'organization' }, { billingSubject: 'bogus' }]) {
    const ref = colOf(tableOf(billingSchemas(cfg), 'subscriptions'), 'organization_id')
    assert.ok(ref, `expected organization_id for config ${JSON.stringify(cfg)}`)
    assert.deepEqual(ref.references, { table: 'organizations', column: 'id' })
  }
})

test('billingSubject "user" re-points the FK at users.id', () => {
  const subs = tableOf(billingSchemas({ billingSubject: 'user' }), 'subscriptions')
  const ref = colOf(subs, 'user_id')
  assert.ok(ref)
  assert.deepEqual(ref.references, { table: 'users', column: 'id' })
  assert.equal(colOf(subs, 'organization_id'), undefined)
})

test('the subject FK is unique (one subscription per subject = the upsert key)', () => {
  const subs = tableOf(billingSchemas({}), 'subscriptions')
  assert.equal(colOf(subs, 'organization_id').unique, true)
})

test('it is a mutable row: has both created_at and updated_at', () => {
  const subs = tableOf(billingSchemas({}), 'subscriptions')
  assert.ok(colOf(subs, 'created_at'))
  assert.ok(colOf(subs, 'updated_at'))
})

// ----------------------------------------------------- cross-package merge ----

const subjectTables = () => [
  defineSchema('users', (t) => t.uuid('id').primary()),
  defineSchema('organizations', (t) => t.uuid('id').primary()),
]

test('billing FK resolves cleanly when merged with users/organizations (default)', () => {
  const { conflicts } = mergeSchemas([...subjectTables(), ...billingSchemas({})])
  assert.deepEqual(conflicts, [])
})

test('billing FK resolves cleanly under the per-user subject too', () => {
  const { conflicts } = mergeSchemas([...subjectTables(), ...billingSchemas({ billingSubject: 'user' })])
  assert.deepEqual(conflicts, [])
})

test('the unique subject FK derives a one-to-one relation', () => {
  const { tables } = mergeSchemas([...subjectTables(), ...billingSchemas({})])
  const rels = deriveRelations(tables)
  const fwd = rels.get('subscriptions').forward.find((r) => r.target === 'organizations')
  assert.equal(fwd.toOne, true)
})
