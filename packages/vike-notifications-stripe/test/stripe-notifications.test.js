import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { emitSubscriptionEvent, clearSubscriptionObservers } from 'vike-stripe/subscription/events'
import { clearChannels } from 'vike-notifications'
import { registerMailChannel } from 'vike-notifications-mail'
import { getOutbox, clearOutbox } from 'vike-mail'
import { registerStripeBillingNotifications, paymentFailed } from '../index.js'

function setup() {
  clearSubscriptionObservers()
  clearChannels()
  clearOutbox()
  clearAdapter()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  registerMailChannel() // so the mail channel is available to deliver
  registerStripeBillingNotifications() // subscribe the bridge
  return adapter
}

// Drive the bridge through vike-stripe's event seam directly (the seam vike-stripe's own
// applySubscriptionEvent emits to — proven in vike-stripe/test/subscription.test.js).
const pastDue = (over = {}) => ({
  subscription: { user_id: 'u-1', status: 'past_due', plan: 'pro', ...over.subscription },
  previousStatus: 'active',
  subjectColumn: 'user_id',
  subjectId: 'u-1',
  ...over,
})

test('a user transitioning into past_due is notified (mail + in-app feed row)', async () => {
  const adapter = setup()
  await adapter.insert('users', { id: 'u-1', email: 'payer@example.com' })

  await emitSubscriptionEvent(pastDue())

  const mail = getOutbox()
  assert.equal(mail.length, 1)
  assert.equal(mail[0].to, 'payer@example.com') // routed from the hydrated user
  assert.match(mail[0].subject, /payment failed/i)

  const rows = await adapter.find('notifications', { user_id: 'u-1' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, 'payment_failed')
})

test('already past_due (no transition) does not re-notify', async () => {
  const adapter = setup()
  await adapter.insert('users', { id: 'u-1', email: 'payer@example.com' })
  await emitSubscriptionEvent(pastDue({ previousStatus: 'past_due' }))
  assert.equal(getOutbox().length, 0)
  assert.equal((await adapter.find('notifications', {})).length, 0)
})

test('a non-past_due transition does not notify', async () => {
  const adapter = setup()
  await adapter.insert('users', { id: 'u-1', email: 'payer@example.com' })
  await emitSubscriptionEvent({ subscription: { user_id: 'u-1', status: 'active', plan: 'pro' }, previousStatus: null, subjectColumn: 'user_id' })
  assert.equal(getOutbox().length, 0)
})

test('an org (b2b) subject is skipped — no personal inbox', async () => {
  const adapter = setup()
  await emitSubscriptionEvent({
    subscription: { organization_id: 'org-1', status: 'past_due', plan: 'pro' },
    previousStatus: 'active',
    subjectColumn: 'organization_id',
    subjectId: 'org-1',
  })
  assert.equal(getOutbox().length, 0)
  assert.equal((await adapter.find('notifications', {})).length, 0)
})

test('paymentFailed renders content for mail + database', () => {
  const n = paymentFailed({ plan: 'pro' })
  assert.deepEqual(n.via(), ['mail', 'database'])
  assert.match(n.toMail().subject, /payment failed/i)
  assert.equal(n.toDatabase().type, 'payment_failed')
  assert.match(n.toDatabase().data.body, /pro/)
})
