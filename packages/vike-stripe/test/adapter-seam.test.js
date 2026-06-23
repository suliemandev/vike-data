// The adapter seam (#66): vike-stripe's wired instance routes its writes through
// the adapter the APP registered (setAdapter), not a hardcoded one. Own test file
// so the lazy globalThis instance is built fresh in this process — after the adapter
// is set, before the first access.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, ADAPTER_OPS } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'

// A recording adapter over memory: real behaviour, plus a log of the ops it saw, so
// we can assert the extension wrote through THIS instance. Wraps every op in the
// contract (ADAPTER_OPS) so it stays valid as the surface grows.
function spyAdapter() {
  const inner = createMemoryAdapter()
  const calls = []
  const wrap = (op) => async (...args) => {
    calls.push({ op, table: args[0] })
    return inner[op](...args)
  }
  const spy = { calls }
  for (const op of ADAPTER_OPS) spy[op] = wrap(op)
  return spy
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
