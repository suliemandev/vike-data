// vike-notifications — the framework-agnostic CORE (the "director" over the channels).
//
// notify(notifiable, notification) informs a user about an intent and fans it out to the
// channels they should hear it on. A NOTIFICATION is a plain-object factory:
//
//   { via(user) -> string[], toMail(user), toPush(user), toDatabase(user), ... }
//
// notify() resolves via(), then dispatches ONE vike-queue job PER selected channel, so one
// bad channel can't block the others (mirrors vike-push's job-per-subscription). Each
// channel is a `{ name, send(notifiable, rendered) }` registered at runtime
// (registerChannel). The built-in `database` channel — this package owns the
// `notifications` table — is always present for the in-app feed.
//
// The channels route differently (mail by `.email`, push by `.id`), so the NOTIFIABLE is
// the user row `{ id, email, ... }`; a bare user id is hydrated from the `users` table.
// Each channel reads the routing field it needs off the notifiable.
//
// notify() is layered ON TOP of the channels, not parallel to them: a channel adapter's
// send() ultimately calls the channel package's own sender (sendMail / sendPush). No
// reverse dependency — the channel packages never import this one.
//
// SERVER-ONLY (the ORM adapter + vike-queue). The client feed helpers live in
// vike-notifications/client and the bell UI in /react, /vue; they import none of this.
import { registerJob, getJob, dispatch } from 'vike-queue'
import { getAdapter } from '@universal-orm/core'
import { databaseChannel } from './database-channel.js'

const CHANNELS_KEY = Symbol.for('vike-notifications.channels')
const JOB = 'vike-notifications:deliver'
const USERS_TABLE = 'users'

// The channel registry — a keyed Map (many channels), like vike-queue's job registry,
// not a single-value port. Cached on globalThis so duplicate module evaluation (pointer
// imports, dev HMR) can't fork it. The built-in database channel is (re)added on every
// access, so it survives a clearChannels() and a forked evaluation.
function channelRegistry() {
  const reg = (globalThis[CHANNELS_KEY] ??= new Map())
  if (!reg.has(databaseChannel.name)) reg.set(databaseChannel.name, databaseChannel)
  return reg
}

/**
 * Register a channel: `{ name, send(notifiable, rendered) }`. Idempotent per name (last
 * wins), so an adapter package can self-register at module load. Accepts the channel
 * object directly (its `name` is the key).
 */
export function registerChannel(channel) {
  if (!channel || typeof channel.send !== 'function') {
    throw new Error('registerChannel: expected a channel with a send(notifiable, rendered) method')
  }
  if (typeof channel.name !== 'string' || !channel.name) {
    throw new Error('registerChannel: a channel needs a non-empty string name')
  }
  channelRegistry().set(channel.name, channel)
  return channel.name
}

/** The channel registered under a name, or undefined. */
export function getChannel(name) {
  return channelRegistry().get(name)
}

/** Every registered channel (the built-in database channel is always included). */
export function getChannels() {
  return [...channelRegistry().values()]
}

/** Clear the registry (tests). The database channel re-appears on the next access. */
export function clearChannels() {
  delete globalThis[CHANNELS_KEY]
}

function requireAdapter() {
  const adapter = getAdapter()
  if (!adapter) {
    throw new Error('vike-notifications: no universal-orm adapter registered (call setAdapter() first)')
  }
  return adapter
}

// Render a notification for one channel by its convention method: channel `mail` ->
// `toMail(user)`, `database` -> `toDatabase(user)`, a custom `slack` -> `toSlack(user)`.
// Returns undefined when the notification doesn't render for that channel.
function renderFor(notification, channelName, notifiable) {
  const method = 'to' + channelName[0].toUpperCase() + channelName.slice(1)
  const fn = notification[method]
  return typeof fn === 'function' ? fn(notifiable) : undefined
}

// The conventional routing field per channel for a User notifiable: mail delivers to an
// address, push to a user id; anything else keys on the id.
const ROUTE_FIELD = { mail: 'email', push: 'id', database: 'id' }

/**
 * Resolve a notifiable's route for a channel — the field a channel adapter delivers to
 * (mail -> `.email`, push -> `.id`). This is the SINGLE seam channel adapters route
 * through, instead of reading `notifiable.email` / `.id` inline, so a future non-User
 * notifiable (a `routeNotificationFor(channel)` on the notifiable, or an on-demand
 * `route({ mail, push })` target) becomes an additive change here, never a breaking one
 * across every adapter (#206). Today it just returns the conventional user field.
 */
export function routeFor(notifiable, channel) {
  // Future: if (typeof notifiable?.routeNotificationFor === 'function')
  //           return notifiable.routeNotificationFor(channel)
  const field = ROUTE_FIELD[channel] ?? 'id'
  return notifiable?.[field]
}

// Turn the notify() target into a user row. An object is taken as the row already; a
// string/number is a user id, hydrated from the users table (so callers can pass either).
async function resolveNotifiable(notifiable) {
  if (notifiable && typeof notifiable === 'object') return notifiable
  const adapter = requireAdapter()
  const user = (await adapter.find(USERS_TABLE, { id: notifiable }))[0]
  if (!user) throw new Error(`vike-notifications: no user found for id ${JSON.stringify(notifiable)}`)
  return user
}

// The delivery job: one run per (notification x channel). Resolves the channel at RUN
// time so a channel registered after dispatch but before the worker runs is still
// honoured. Throws (so the queue can retry/fail the row) if the channel went away.
const deliverHandler = async ({ channel, notifiable, rendered }) => {
  const ch = getChannel(channel)
  if (!ch) throw new Error(`vike-notifications: no channel registered for "${channel}"`)
  await ch.send(notifiable, rendered)
}
function ensureDeliverJob() {
  if (!getJob(JOB)) registerJob(JOB, deliverHandler)
}
ensureDeliverJob()

/**
 * Notify a user about an intent, fanning out to the channels `notification.via(user)`
 * selects. Hydrates a bare user id to the user row, then dispatches one vike-queue job
 * per channel that is BOTH selected AND registered AND rendered for (so a missing channel
 * adapter or an unrendered channel is skipped, not a hard error). Returns the
 * per-channel dispatch results. A no-op (empty array) when nothing applies.
 */
export async function notify(notifiable, notification, opts = {}) {
  ensureDeliverJob()
  const user = await resolveNotifiable(notifiable)
  const selected = (typeof notification.via === 'function' ? notification.via(user) : []) || []
  const jobs = []
  for (const channel of selected) {
    if (!getChannel(channel)) continue // not wired (e.g. no mail adapter) — skip, don't throw
    const rendered = renderFor(notification, channel, user)
    if (rendered === undefined) continue // the notification doesn't render for this channel
    jobs.push(dispatch(JOB, { channel, notifiable: user, rendered }, { maxAttempts: opts.maxAttempts ?? 3 }))
  }
  return Promise.all(jobs)
}

export const DELIVER_JOB = JOB
