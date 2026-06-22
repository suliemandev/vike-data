// The webhook server tier: POST /stripe/webhook -> billing core -> universal-orm
// upsert, over a real Request/Response. Exercises the raw handler (the enhance()
// wrapper is just metadata for Vike's middleware slot).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSchemas } from '@vike-data/universal-schema'
import { createRepository } from '@vike-data/universal-orm'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createBilling } from '../billing.js'
import { billingWebhookHandler } from '../middleware.js'
import billingSchemas from '../schemas.js'

function makeHandler() {
  const { tables } = mergeSchemas(billingSchemas({}))
  const db = createRepository({ tables }, createMemoryAdapter())
  const billing = createBilling({ db })
  return { handle: billingWebhookHandler(billing), db }
}

const post = (body) =>
  new Request('http://localhost/stripe/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

test('a subscription webhook upserts and responds 200 with the row', async () => {
  const { handle, db } = makeHandler()
  const res = await handle(post({ subject: 'org1', plan: 'pro', status: 'active' }))
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.ok, true)
  assert.equal(json.subscription.plan, 'pro')
  assert.equal((await db.subscriptions.findOne({ organization_id: 'org1' })).plan, 'pro')
})

test('replaying the same subject converges to one row', async () => {
  const { handle, db } = makeHandler()
  await handle(post({ subject: 'org1', plan: 'pro' }))
  await handle(post({ subject: 'org1', plan: 'enterprise' }))
  assert.equal((await db.subscriptions.find()).length, 1)
  assert.equal((await db.subscriptions.findOne({ organization_id: 'org1' })).plan, 'enterprise')
})

test('non-webhook paths fall through (undefined)', async () => {
  const { handle } = makeHandler()
  const res = await handle(new Request('http://localhost/something-else'))
  assert.equal(res, undefined)
})

test('a non-POST to the webhook is 405', async () => {
  const { handle } = makeHandler()
  const res = await handle(new Request('http://localhost/stripe/webhook', { method: 'GET' }))
  assert.equal(res.status, 405)
})

test('invalid JSON is a 400, nothing written', async () => {
  const { handle, db } = makeHandler()
  const res = await handle(post('{not json'))
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error, 'invalid-json')
  assert.equal((await db.subscriptions.find()).length, 0)
})

test('a subjectless event is a 400 from the core', async () => {
  const { handle } = makeHandler()
  const res = await handle(post({ plan: 'pro' }))
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error, 'missing-subject')
})
