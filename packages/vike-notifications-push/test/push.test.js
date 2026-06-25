import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { clearChannels, getChannel, notify } from 'vike-notifications'
import { saveSubscription, getPushOutbox, clearPushOutbox, clearPushTransport } from 'vike-push'
import { registerPushChannel, pushChannel } from '../index.js'

function setup() {
  clearChannels()
  clearAdapter()
  clearPushTransport()
  clearPushOutbox()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  registerPushChannel() // re-register after clearChannels (the import-time self-register ran once)
  return adapter
}

const sub = (endpoint) => ({ endpoint, keys: { p256dh: 'pub', auth: 'sec' } })
const ping = () => ({ via: () => ['push'], toPush: () => ({ title: 'Ping', body: 'yo' }) })

test('registerPushChannel registers a `push` channel into the core', () => {
  setup()
  assert.equal(getChannel('push')?.name, 'push')
  assert.equal(getChannel('push'), pushChannel)
})

test('the push channel delivers via sendPush to the notifiable id\'s subscriptions (routeFor)', async () => {
  setup()
  await saveSubscription('u-1', sub('https://push/a'))
  await saveSubscription('u-1', sub('https://push/b'))
  await saveSubscription('u-other', sub('https://push/c'))

  await notify({ id: 'u-1', email: 'x@y.z' }, ping())

  const out = getPushOutbox()
  assert.equal(out.length, 2) // only u-1's two subscriptions (routed by the notifiable id)
  assert.deepEqual(out[0].payload, { title: 'Ping', body: 'yo' })
})

test('a notifiable with no subscriptions is a no-op', async () => {
  setup()
  await notify({ id: 'nobody' }, ping())
  assert.equal(getPushOutbox().length, 0)
})

test('send() routes by the notifiable id', async () => {
  setup()
  await saveSubscription('u-2', sub('https://push/d'))
  await pushChannel.send({ id: 'u-2' }, { title: 'Direct' })
  const out = getPushOutbox()
  assert.equal(out.length, 1)
  assert.equal(out[0].payload.title, 'Direct')
})
