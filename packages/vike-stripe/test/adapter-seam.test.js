// The adapter seam (#66): vike-stripe's wired instance routes its writes through
// the adapter the APP registered (setAdapter), not a hardcoded one. Own test file
// so the lazy globalThis instance is built fresh in this process — after the adapter
// is set, before the first access.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'

// A recording adapter over memory: real behaviour, plus a log of the ops it saw, so
// we can assert the extension wrote through THIS instance.
function spyAdapter() {
  const inner = createMemoryAdapter()
  const calls = []
  const wrap = (op) => async (...args) => {
    calls.push({ op, table: args[0] })
    return inner[op](...args)
  }
  return {
    calls,
    insert: wrap('insert'),
    find: wrap('find'),
    upsert: wrap('upsert'),
    update: wrap('update'),
    delete: wrap('delete'),
  }
}

test('the wired subscription instance writes through the app-registered adapter', async () => {
  const spy = spyAdapter()
  setAdapter(spy)

  // Imported AFTER setAdapter so the lazy build resolves the registered adapter.
  const { subscriptions } = await import('../subscription/instance.js')

  const res = await subscriptions.applySubscriptionEvent({ subject: 'org1', plan: 'pro' })
  assert.equal(res.ok, true)

  // The write landed on the registered (spy) adapter, not a fallback memory one.
  assert.ok(
    spy.calls.some((c) => c.op === 'upsert' && c.table === 'subscriptions'),
    'expected an upsert on subscriptions through the registered adapter',
  )
  const found = await subscriptions.subscriptionFor('org1')
  assert.equal(found.plan, 'pro')
})
