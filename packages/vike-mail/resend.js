// The Resend mail transport: the first PRODUCTION transport for the vike-mail port.
//
// vike-mail ships only the dev console/outbox transport by default (the "memory adapter"
// of mail). This is the real one: it delivers over Resend's HTTP API. The app wires it
// once, exactly like picking a universal-orm adapter:
//
//   import { setMailTransport } from 'vike-mail'
//   import { resendTransport } from 'vike-mail/resend'
//   setMailTransport(resendTransport({ apiKey: process.env.RESEND_API_KEY, from: 'Acme <hi@acme.com>' }))
//
// An opt-in SUBPATH (not part of the default import) so the port stays provider-neutral
// and nothing Resend-specific is pulled in unless the app asks for it. SERVER-ONLY, like
// all of vike-mail (it carries the API key). Delivery still runs through vike-queue, so a
// transient Resend failure is retried by the queue (sendMail's maxAttempts); this transport
// just throws on a non-2xx so the queue can see the failure.

const DEFAULT_BASE_URL = 'https://api.resend.com'

/**
 * Build a Resend transport.
 *
 * @param {object} opts
 * @param {string} opts.apiKey   Resend API key (required). Keep it server-side (env).
 * @param {string} [opts.from]   Default sender, e.g. `'Acme <hi@acme.com>'`. Used when a
 *                               message has no `from`. Resend requires a sender, so one of
 *                               the two must be present or send() throws.
 * @param {string} [opts.baseUrl] Override the API base (testing / a proxy).
 * @param {Function} [opts.fetch] Override the fetch implementation (testing). Defaults to
 *                               the global fetch (Node 18+).
 * @returns {{ name: string, send: (message: object) => Promise<object> }}
 */
export function resendTransport({ apiKey, from, baseUrl = DEFAULT_BASE_URL, fetch } = {}) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('resendTransport: an apiKey string is required')
  }
  const doFetch = fetch ?? globalThis.fetch
  if (typeof doFetch !== 'function') {
    throw new Error('resendTransport: no fetch available (Node 18+ or pass opts.fetch)')
  }
  const endpoint = `${baseUrl.replace(/\/$/, '')}/emails`

  return {
    name: 'resend',
    async send(message) {
      const sender = message.from ?? from
      if (!sender) {
        throw new Error('resendTransport: no sender (set `from` on the transport or the message)')
      }
      // Resend's payload. Only send the body fields that are present; an explicit null
      // html/text (vike-mail normalizes missing ones to null) would be rejected.
      const payload = { from: sender, to: message.to, subject: message.subject }
      if (message.html != null) payload.html = message.html
      if (message.text != null) payload.text = message.text

      const res = await doFetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        // Surface Resend's error message when it sends one, so the queue's failure record
        // (and the logs) say WHY. Throwing lets vike-queue retry per maxAttempts.
        const detail = await readError(res)
        throw new Error(`resendTransport: Resend responded ${res.status}${detail ? ` - ${detail}` : ''}`)
      }
      // On success Resend returns `{ id }`. Return it so a caller/worker can correlate.
      return safeJson(res)
    },
  }
}

// Pull a human message out of an error response without letting a parse failure mask the
// original HTTP status (the status is what the caller really needs).
async function readError(res) {
  try {
    const body = await res.json()
    return body?.message ?? body?.error ?? null
  } catch {
    try {
      return (await res.text())?.slice(0, 200) || null
    } catch {
      return null
    }
  }
}

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}
