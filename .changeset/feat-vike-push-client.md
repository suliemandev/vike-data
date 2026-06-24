---
'vike-push': minor
---

Add the vike-push client: a service worker (`vike-push/sw`), framework-agnostic subscribe helpers (`vike-push/client`), and a subscribe control for React and Vue (`vike-push/react/PushToggle`, `vike-push/vue/PushToggle`). The control reads the app's `vapidPublicKey` config, registers the service worker, subscribes via PushManager, and posts the subscription to `/push/subscribe`. Resolves the two open questions: the service worker is shipped at `vike-push/sw` and served from the app's `public/vike-push-sw.js` at root scope, and the VAPID public key reaches the client through the `vapidPublicKey` config (the private key stays server-side). Demonstrated in app-react and app-vue.
