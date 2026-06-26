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
// Each channel reads the address it needs through routeFor() — the single routing seam, so
// a non-User notifiable works too: an on-demand `route({ mail, push })` target, or an entity
// that carries its own `routes` map, resolves ahead of the user-field convention (#206).
//
// notify() is layered ON TOP of the channels, not parallel to them: a channel adapter's
// send() ultimately calls the channel package's own sender (sendMail / sendPush). No
// reverse dependency — the channel packages never import this one.
//
// SERVER-ONLY (the ORM adapter + vike-queue). The client feed helpers live in
// vike-notifications/client and the bell UI in /react, /vue; they import none of this.
import { registerJob, getJob, dispatch } from 'vike-queue'
import { getAdapter } from '@universal-orm/core'
import { resolveSubject } from 'vike-auth/subject'
import { databaseChannel } from './database-channel.js'

const CHANNELS_KEY = Symbol.for('vike-notifications.channels')
const JOB = 'vike-notifications:deliver'
// Hydrate a bare user id from vike-auth's subject table, following its configurable name
// (subject.js) so a renamed users table is read from the same single source the schema and
// the auth store use. Defaults to `users`.
const USERS_TABLE = resolveSubject().users

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

// The distinct fields any channel routes on (the values of ROUTE_FIELD, plus the `id`
// fallback routeFor uses for an unknown channel). The notifiable is projected to ONLY these
// before dispatch — see routableNotifiable.
const ROUTABLE_FIELDS = [...new Set([...Object.values(ROUTE_FIELD), 'id'])]

// Project a resolved user row down to just the fields a channel routes on. notify() dispatches
// one vike-queue job per channel and the driver PERSISTS the payload (JSON in the jobs table),
// so handing it the whole user row would write password_hash and any other secret column to
// durable storage where it lingers after delivery (#229). Channels only ever read the route
// field via routeFor(), so this is all they need; rendering already happened against the full
// user before dispatch.
//
// An explicit `routes` map (a non-User or on-demand notifiable — see route()) is carried
// through too, since routeFor() runs AFTER dispatch, in the worker, against THIS projection.
// It is plain data, so it survives the JSON payload (a method could not — the reason the
// route seam is data, not a Laravel-style `routeNotificationFor()` method). Only the channel
// addresses are kept, nothing secret.
function routableNotifiable(user) {
  const out = {}
  for (const f of ROUTABLE_FIELDS) if (user?.[f] !== undefined) out[f] = user[f]
  if (user?.routes && typeof user.routes === 'object') out.routes = { ...user.routes }
  return out
}

/**
 * Resolve a notifiable's route for a channel — the address a channel adapter delivers to
 * (mail -> an email, push -> a user id). This is the SINGLE seam channel adapters route
 * through, instead of reading `notifiable.email` / `.id` inline, so a non-User notifiable is
 * handled in ONE place, never a breaking change across every adapter (#206).
 *
 * Resolution order:
 *   1. An explicit per-channel route on the notifiable (`notifiable.routes[channel]`) — set by
 *      an on-demand `route({ mail, push })` target, or by an entity that carries its own
 *      routes (a Team's billing address). This is plain DATA, not a method: the notifiable is
 *      serialized into the vike-queue payload before delivery, so a `routeNotificationFor()`
 *      method (the Laravel shape) would be stripped by the queue boundary. A data map survives.
 *   2. The conventional User field (mail -> `.email`, push/unknown -> `.id`).
 * Order matters: an explicit route always wins, so a User row can override one channel (e.g. a
 * separate `notification_email`) by carrying `routes: { mail: ... }` without losing the rest.
 */
export function routeFor(notifiable, channel) {
  const explicit = notifiable?.routes?.[channel]
  if (explicit !== undefined) return explicit
  const field = ROUTE_FIELD[channel] ?? 'id'
  return notifiable?.[field]
}

/**
 * An ON-DEMAND (anonymous) notifiable: a target that is nothing but its per-channel routes,
 * with no stored user and no in-app feed row. `route({ mail: 'a@b.c', push: deviceId })`
 * notifies an address directly — a guest-checkout receipt, a contact-form auto-reply, an
 * alert to an ops inbox. Pass the result straight to notify(); routeFor() reads the explicit
 * route, so no users-table hydration happens.
 *
 * The in-app `database` feed is user-scoped BY DESIGN (a feed only means something for a
 * person's inbox), so an on-demand target naturally uses the delivery channels, not the feed
 * — its notification's via() simply doesn't select `database`.
 */
export function route(routes) {
  if (!routes || typeof routes !== 'object' || Array.isArray(routes)) {
    throw new Error('route(): expected a { channel: address } map, e.g. route({ mail: "a@b.c" })')
  }
  return { routes: { ...routes } }
}

// Turn the notify() target into a notifiable. An object is taken as-is (a user row, or an
// on-demand `route()` target carrying `routes`); a string/number is a user id, hydrated from
// the users table (so callers can pass either).
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
    // Dispatch only the routable fields, never the full user row (#229) — the payload is persisted.
    jobs.push(dispatch(JOB, { channel, notifiable: routableNotifiable(user), rendered }, { maxAttempts: opts.maxAttempts ?? 3 }))
  }
  return Promise.all(jobs)
}

export const DELIVER_JOB = JOB
