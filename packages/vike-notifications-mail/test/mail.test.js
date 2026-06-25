import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clearChannels, getChannel, notify } from 'vike-notifications'
import { getOutbox, clearOutbox } from 'vike-mail'
import { registerMailChannel, mailChannel } from '../index.js'

function setup() {
  clearChannels()
  clearOutbox()
  registerMailChannel() // re-register after clearChannels (the import-time self-register ran once)
}

const welcome = () => ({
  via: () => ['mail'],
  toMail: () => ({ subject: 'Welcome', html: '<p>hi</p>' }),
})

test('registerMailChannel registers a `mail` channel into the core', () => {
  setup()
  assert.equal(getChannel('mail')?.name, 'mail')
  assert.equal(getChannel('mail'), mailChannel)
})

test('the mail channel delivers via sendMail to the notifiable\'s email (routeFor)', async () => {
  setup()
  await notify({ id: 'u-1', email: 'ada@example.com' }, welcome())
  const out = getOutbox()
  assert.equal(out.length, 1)
  assert.equal(out[0].to, 'ada@example.com') // routed from the notifiable, not hardcoded
  assert.equal(out[0].subject, 'Welcome')
})

test('routeFor owns the recipient — a `to` in the rendered content is overridden', async () => {
  setup()
  const notif = {
    via: () => ['mail'],
    toMail: () => ({ to: 'attacker@evil.com', subject: 'x', html: 'y' }), // tries to set its own to
  }
  await notify({ id: 'u-1', email: 'real@example.com' }, notif)
  const out = getOutbox()
  assert.equal(out.length, 1)
  assert.equal(out[0].to, 'real@example.com') // the notifiable's route wins, not rendered.to
})

test('send() can be driven directly with a notifiable + rendered content', async () => {
  setup()
  await mailChannel.send({ id: 'u-2', email: 'direct@example.com' }, { subject: 'Direct', html: 'z' })
  const out = getOutbox()
  assert.equal(out.length, 1)
  assert.equal(out[0].to, 'direct@example.com')
  assert.equal(out[0].subject, 'Direct')
})
