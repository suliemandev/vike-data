// vike-push - the framework-agnostic CLIENT helpers.
//
// The browser half of the channel: detect support, register the service worker,
// subscribe via PushManager with the app's VAPID public key, and POST the subscription
// to the /push/subscribe endpoint (which binds it to the signed-in user). The React and
// Vue controls (vike-push/react, vike-push/vue) are thin wrappers over these.
//
// CLIENT-ONLY: this imports nothing from vike-push's server module (index.js, with
// node:crypto + the ORM adapter), so it is safe in the client bundle. It only touches
// browser APIs and fetch.

/** Is Web Push usable in this browser (service worker + PushManager + Notification)? */
export function isPushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Convert a base64url VAPID public key to the Uint8Array the PushManager wants as its
 * `applicationServerKey`. (The browser validates this is a real P-256 point.)
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

/** Register (or return the existing) service worker registration for `swUrl`. */
export async function registerServiceWorker(swUrl = '/vike-push-sw.js') {
  return navigator.serviceWorker.register(swUrl)
}

/** The current push subscription if one exists (after the SW is ready), else null. */
export async function getExistingSubscription() {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

/**
 * Full subscribe flow: ask permission, register the SW, subscribe with the VAPID public
 * key, and POST the subscription to the server. Returns the PushSubscription. Throws with
 * a clear message if unsupported, denied, or the server rejects it.
 */
export async function subscribe({ vapidPublicKey, swUrl = '/vike-push-sw.js', subscribeUrl = '/push/subscribe' } = {}) {
  if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser')
  if (!vapidPublicKey) throw new Error('subscribe: a VAPID public key is required (set the app `vapidPublicKey` config)')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted')

  const reg = await registerServiceWorker(swUrl)
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  const res = await fetch(subscribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('The server rejected the push subscription')
  return sub
}

/**
 * Unsubscribe: tell the server to drop the subscription, then unsubscribe in the browser.
 * Returns true if there was a subscription to remove, false otherwise.
 */
export async function unsubscribe({ unsubscribeUrl = '/push/unsubscribe' } = {}) {
  const sub = await getExistingSubscription()
  if (!sub) return false
  await fetch(unsubscribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
    credentials: 'same-origin',
  })
  await sub.unsubscribe()
  return true
}
