---
'vike-push': minor
---

feat: add a real Web Push / VAPID transport (`vike-push/web-push`). vike-push shipped only the dev console/outbox transport; this is the first production one. The app registers it once, `setPushTransport(webPushTransport({ subject, vapidPublicKey, vapidPrivateKey }))`, and every `sendPush` delivers for real with no caller change. It encrypts the payload (RFC 8291, the aes128gcm encoding of RFC 8188), signs a VAPID JWT (RFC 8292, ES256), and POSTs to the subscription endpoint with the Web Push headers. Zero runtime dependency, all crypto is Node's built-in WebCrypto (ECDH P-256, HKDF, AES-128-GCM, ECDSA), and the encryption is verified against the RFC 8291 Appendix A test vector. An opt-in subpath so the neutral port stays provider-free unless an app asks for it, and server-only (it carries the VAPID private key). It throws on a non-2xx so vike-queue retries per the send job's maxAttempts; `fetch` is injectable for testing.
