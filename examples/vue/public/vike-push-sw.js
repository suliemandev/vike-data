// vike-push service worker (the canonical copy).
//
// A push subscription requires an active service worker registration, and the browser
// dispatches incoming push messages to it. This handles the two events that matter:
// `push` (show the notification) and `notificationclick` (focus/open the target URL).
//
// SERVING: a service worker controls pages under its own path scope, so it must be
// served from the app origin at (usually) the root. Vike apps serve `public/` at the
// root, so the app places this file at `public/vike-push-sw.js` (a documented one-line
// copy, the eject-style ownership the repo prefers); the subscribe control registers
// `/vike-push-sw.js` by default. This file is plain SW script (no ES module imports),
// so it loads directly with no build step.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Notification'
  const options = {
    body: data.body || '',
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      const existing = all.find((c) => c.url === url)
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    }),
  )
})
