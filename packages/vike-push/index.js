// vike-push - the Web Push channel (server side).
//
// The second channel after vike-mail, same neutral-port shape, but push is
// user-targeted and stateful: a user must subscribe first (browser permission + a
// PushManager subscription stored in `push_subscriptions`). So the producer calls
// sendPush(userId, payload), and vike-push looks up that user's subscriptions and
// delivers to each through the registered transport, over vike-queue.
//
//   producer:  import { sendPush } from 'vike-push'; await sendPush(user.id, { title, body })
//   app:       import { setPushTransport } from 'vike-push'; setPushTransport(webPush(...))
//
// Optional-runtime, like vike-mail: with no transport registered the built-in
// console/outbox transport records what would be pushed, so the seam is provable
// without real Web Push/VAPID crypto. A real transport (VAPID signing) is registered
// by the app and is the swappable provider.
//
// This module is SERVER-ONLY (it needs the universal-orm adapter and node:crypto). The
// client subscribe control (vike-push/react, vike-push/vue) imports NONE of it; it only
// talks to the /push/subscribe endpoint. Keep it that way so the client build stays clean.
import { randomUUID } from 'node:crypto'
import { registerJob, getJob, dispatch } from 'vike-queue'
import { getAdapter } from '@universal-orm/core'
import { createPort, createDevTransport } from '@vike-data/kit'

const JOB = 'vike-push:send'
const TABLE = 'push_subscriptions'

// The zero-config default transport: records each delivery to a dev outbox and logs a one-liner,
// so the seam is provable without real Web Push/VAPID crypto.
const dev = createDevTransport({
  name: 'vike-push',
  entry: (subscription, payload) => ({ subscription, payload }),
  line: (subscription, payload) =>
    `[vike-push] (dev, no transport) endpoint=${JSON.stringify(subscription.endpoint)} payload=${JSON.stringify(payload)}`,
})

/** Deliveries captured by the default console/outbox transport (dev/test inspection). */
export const getPushOutbox = dev.getOutbox

/** Clear the dev outbox (tests). */
export const clearPushOutbox = dev.clearOutbox

// The transport registry (the set/get/clear provider port), over @vike-data/kit. A
// transport is `{ send(subscription, payload) }`, subscription `{ endpoint, keys }`.
const transportPort = createPort({
  name: 'vike-push.transport',
  validate: (t) => {
    if (!t || typeof t.send !== 'function') {
      throw new Error('setPushTransport: expected a transport with a send(subscription, payload) method')
    }
  },
  default: () => dev.transport,
})

/** Register the app's push transport. */
export function setPushTransport(transport) {
  transportPort.set(transport)
}

/** The registered transport, or the built-in console/outbox default. */
export function getPushTransport() {
  return transportPort.get()
}

/** Clear the registered transport (tests). */
export function clearPushTransport() {
  transportPort.clear()
}

function requireAdapter() {
  const adapter = getAdapter()
  if (!adapter) {
    throw new Error('vike-push: no universal-orm adapter registered (call setAdapter() first)')
  }
  return adapter
}

/**
 * Store (or refresh) a browser push subscription for a user. Keyed by the unique
 * `endpoint`, so re-subscribing updates the same row rather than duplicating it.
 * `subscription` is the PushManager shape: `{ endpoint, keys: { p256dh, auth } }`.
 */
export async function saveSubscription(userId, subscription) {
  const adapter = requireAdapter()
  const ts = new Date().toISOString()
  // Normalize the subscription's encryption material once (the column is auth_secret,
  // not auth; missing keys become null) so the update and insert paths stay in sync.
  const keys = subscription.keys || {}
  const p256dh = keys.p256dh ?? null
  const authSecret = keys.auth ?? null
  const existing = (await adapter.find(TABLE, { endpoint: subscription.endpoint }))[0]
  if (existing) {
    await adapter.update(TABLE, { endpoint: subscription.endpoint }, {
      user_id: userId, p256dh, auth_secret: authSecret, updated_at: ts,
    })
    return { id: existing.id, updated: true }
  }
  const row = {
    id: randomUUID(),
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth_secret: authSecret,
    created_at: ts,
    updated_at: ts,
  }
  await adapter.insert(TABLE, row)
  return { id: row.id, created: true }
}

/**
 * Remove one of a user's subscriptions by endpoint. Scoped to `userId` so a caller can
 * only ever delete its OWN subscription, never another user's row that happens to share
 * (or guess) the endpoint - the delete-side counterpart to saveSubscription's user
 * binding. Returns the number of rows deleted (0 when the user has no such endpoint).
 */
export async function removeSubscription(userId, endpoint) {
  const adapter = requireAdapter()
  return adapter.delete(TABLE, { endpoint, user_id: userId })
}

/**
 * Delete a subscription by its (unique) endpoint regardless of owner. Used internally when
 * the push service reports a subscription is permanently gone (a 404/410, surfaced as a
 * transport error flagged `subscriptionGone`). Unlike removeSubscription this is a trusted
 * system path, not a user request, so it is not user-scoped. Returns the rows deleted.
 */
export async function pruneSubscription(endpoint) {
  const adapter = requireAdapter()
  return adapter.delete(TABLE, { endpoint })
}

// The send job: one delivery per subscription. The job payload carries only the
// subscription's id (a non-secret uuid), NOT its encryption material: vike-queue persists
// the payload (JSON in the jobs table), so dispatching `{ endpoint, keys: { p256dh, auth } }`
// would write the RFC 8291 `auth` secret to durable storage where it lingers after delivery
// (#229). Instead the handler re-reads the row here and reconstructs the subscription at RUN
// time - which also picks up the current keys if the subscription was refreshed since
// dispatch. A row deleted before the worker runs (the user unsubscribed) is a no-op.
//
// Resolves the transport at RUN time too, so a transport registered after dispatch but
// before the worker runs is still honoured.
//
// A transport may flag a send error with `subscriptionGone` (a 404/410 from the push
// service): the subscription is permanently gone, so prune the dead row and return without
// rethrowing - retrying it would only fail forever. Any other error propagates so vike-queue
// retries the job per its maxAttempts (a transient push-service failure).
const sendHandler = async ({ subscriptionId, payload }) => {
  const adapter = requireAdapter()
  const row = (await adapter.find(TABLE, { id: subscriptionId }))[0]
  if (!row) return // subscription removed before delivery - nothing to send
  const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_secret } }
  try {
    await getPushTransport().send(subscription, payload)
  } catch (err) {
    if (err && err.subscriptionGone && row.endpoint) {
      await pruneSubscription(row.endpoint)
      return
    }
    throw err
  }
}
function ensureSendJob() {
  if (!getJob(JOB)) registerJob(JOB, sendHandler)
}
ensureSendJob()

/**
 * Send a push payload to every subscription a user has. Looks up the user's stored
 * subscriptions and dispatches one vike-queue job per subscription (so one bad endpoint
 * does not block the others). Returns the per-subscription dispatch results. A no-op
 * (empty array) when the user has no subscriptions.
 */
export async function sendPush(userId, payload) {
  ensureSendJob()
  const adapter = requireAdapter()
  const rows = await adapter.find(TABLE, { user_id: userId })
  return Promise.all(
    rows.map((row) => dispatch(JOB, { subscriptionId: row.id, payload }, { maxAttempts: 3 })),
  )
}

export const SEND_JOB = JOB
