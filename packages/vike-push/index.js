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

const TRANSPORT_KEY = Symbol.for('vike-push.transport')
const DEFAULT_TRANSPORT_KEY = Symbol.for('vike-push.transport.default')
const OUTBOX_KEY = Symbol.for('vike-push.outbox')
const JOB = 'vike-push:send'
const TABLE = 'push_subscriptions'

function outbox() {
  return (globalThis[OUTBOX_KEY] ??= [])
}

/** Deliveries captured by the default console/outbox transport (dev/test inspection). */
export function getPushOutbox() {
  return outbox()
}

/** Clear the dev outbox (tests). */
export function clearPushOutbox() {
  outbox().length = 0
}

function defaultTransport() {
  return {
    async send(subscription, payload) {
      outbox().push({ subscription, payload })
      // eslint-disable-next-line no-console
      console.log(`[vike-push] (dev, no transport) endpoint=${JSON.stringify(subscription.endpoint)} payload=${JSON.stringify(payload)}`)
    },
  }
}

/**
 * Register the app's push transport. A transport is `{ send(subscription, payload) }`,
 * where subscription is `{ endpoint, keys: { p256dh, auth } }`. Validated at the call
 * site, like setMailTransport / setAdapter.
 */
export function setPushTransport(transport) {
  if (!transport || typeof transport.send !== 'function') {
    throw new Error('setPushTransport: expected a transport with a send(subscription, payload) method')
  }
  globalThis[TRANSPORT_KEY] = transport
}

/** The registered transport, or the built-in console/outbox default. */
export function getPushTransport() {
  return globalThis[TRANSPORT_KEY] ?? (globalThis[DEFAULT_TRANSPORT_KEY] ??= defaultTransport())
}

/** Clear the registered transport (tests). */
export function clearPushTransport() {
  delete globalThis[TRANSPORT_KEY]
  delete globalThis[DEFAULT_TRANSPORT_KEY]
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
  const keys = subscription.keys || {}
  const existing = (await adapter.find(TABLE, { endpoint: subscription.endpoint }))[0]
  if (existing) {
    await adapter.update(TABLE, { endpoint: subscription.endpoint }, {
      user_id: userId, p256dh: keys.p256dh ?? null, auth_secret: keys.auth ?? null, updated_at: ts,
    })
    return { id: existing.id, updated: true }
  }
  const row = {
    id: randomUUID(),
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh ?? null,
    auth_secret: keys.auth ?? null,
    created_at: ts,
    updated_at: ts,
  }
  await adapter.insert(TABLE, row)
  return { id: row.id, created: true }
}

/** Remove a subscription by its endpoint (unsubscribe, or a gone/expired endpoint). */
export async function removeSubscription(endpoint) {
  const adapter = requireAdapter()
  return adapter.delete(TABLE, { endpoint })
}

// The send job: one delivery per subscription. Resolves the transport at RUN time so a
// transport registered after dispatch but before the worker runs is still honoured.
const sendHandler = async ({ subscription, payload }) => {
  await getPushTransport().send(subscription, payload)
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
    rows.map((row) =>
      dispatch(
        JOB,
        { subscription: { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_secret } }, payload },
        { maxAttempts: 3 },
      ),
    ),
  )
}

export const SEND_JOB = JOB
