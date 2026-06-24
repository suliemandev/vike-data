// vike-mail - the neutral mail PORT.
//
// The mail twin of @universal-orm/core: it owns the SEND contract + a runtime registry
// for the concrete transport, but ships no real provider. Producers (vike-auth,
// vike-stripe, ...) depend on this port and call sendMail(); the APP registers the
// transport (console/outbox in dev, Resend/SES/SMTP in prod) with setMailTransport,
// exactly like the app picks a universal-orm adapter with setAdapter.
//
//   producer:  import { sendMail } from 'vike-mail'; await sendMail({ to, subject, html })
//   app:       import { setMailTransport } from 'vike-mail'; setMailTransport(resend(...))
//
// Sending goes through vike-queue, so it is background work by default: sendMail()
// dispatches a job whose handler calls the registered transport. With the queue's
// inline driver (the dev default) that runs immediately; with a real queue driver +
// worker it moves off the request path. No caller change either way.
//
// Optional-runtime, like the ORM adapter: with no transport registered, the built-in
// console/outbox transport runs, so sendMail works zero-config (and reproduces the old
// console.log magic-link behaviour, now routed through the seam).
import { registerJob, getJob, dispatch } from 'vike-queue'

const TRANSPORT_KEY = Symbol.for('vike-mail.transport')
const DEFAULT_TRANSPORT_KEY = Symbol.for('vike-mail.transport.default')
const OUTBOX_KEY = Symbol.for('vike-mail.outbox')
const JOB = 'vike-mail:send'

// The dev outbox: every message the default transport "sends", kept in memory so tests
// and a dev UI can inspect what would have gone out. On globalThis so module dup can't
// fork it.
function outbox() {
  return (globalThis[OUTBOX_KEY] ??= [])
}

/** Messages captured by the default console/outbox transport (dev/test inspection). */
export function getOutbox() {
  return outbox()
}

/** Clear the dev outbox (tests). */
export function clearOutbox() {
  outbox().length = 0
}

// The zero-config default transport: records to the outbox and logs a one-liner. This
// is the "memory adapter" of mail: present so nothing has to be wired in dev.
function defaultTransport() {
  return {
    async send(message) {
      outbox().push(message)
      // JSON.stringify both fields so a `to`/`subject` containing a newline cannot forge
      // a log line (log injection); the values are user-influenced.
      // eslint-disable-next-line no-console
      console.log(`[vike-mail] (dev, no transport) to=${JSON.stringify(message.to)} subject=${JSON.stringify(message.subject)}`)
    },
  }
}

/**
 * Register the app's mail transport. A transport is `{ send(message) -> Promise }`,
 * where message is `{ to, subject, html?, text?, from? }`. Validated at the call site
 * like setAdapter, so a malformed transport fails clearly here.
 */
export function setMailTransport(transport) {
  if (!transport || typeof transport.send !== 'function') {
    throw new Error('setMailTransport: expected a transport with a send(message) method')
  }
  globalThis[TRANSPORT_KEY] = transport
}

/** The registered transport, or the built-in console/outbox default. */
export function getMailTransport() {
  return globalThis[TRANSPORT_KEY] ?? (globalThis[DEFAULT_TRANSPORT_KEY] ??= defaultTransport())
}

/** Clear the registered transport (tests). */
export function clearMailTransport() {
  delete globalThis[TRANSPORT_KEY]
  delete globalThis[DEFAULT_TRANSPORT_KEY]
}

// The send job. The handler resolves the transport at RUN time (not enqueue time), so a
// transport registered after dispatch but before the worker runs is still honoured.
const sendHandler = async (message) => {
  await getMailTransport().send(message)
}

// Register the job (idempotent). Called at import so depending on vike-mail wires it,
// AND from sendMail so a clearQueue() (vike-queue's test helper wipes the job registry)
// can't permanently break sending: the next sendMail re-registers it.
function ensureSendJob() {
  if (!getJob(JOB)) registerJob(JOB, sendHandler)
}
ensureSendJob()

function normalize(message) {
  if (!message || typeof message !== 'object') throw new Error('sendMail: message must be an object')
  const { to, subject } = message
  if (!to || typeof to !== 'string') throw new Error('sendMail: message.to is required')
  if (typeof subject !== 'string') throw new Error('sendMail: message.subject is required')
  return {
    to,
    subject,
    html: message.html ?? null,
    text: message.text ?? null,
    from: message.from ?? null,
  }
}

/**
 * Queue an email for delivery. Returns whatever the queue driver returns (inline:
 * resolves once delivered; database: resolves once enqueued). `opts.maxAttempts`
 * caps retries (default 3, since transports are network calls).
 */
export async function sendMail(message, opts = {}) {
  ensureSendJob() // self-heal if the queue's job registry was cleared since import
  const normalized = normalize(message)
  return dispatch(JOB, normalized, { maxAttempts: opts.maxAttempts ?? 3 })
}

export const SEND_JOB = JOB
