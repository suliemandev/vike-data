# vike-mail

The mail port: `sendMail()` plus a swappable transport, sending through vike-queue. The mail twin of `@universal-orm/core`. Producers (vike-auth, vike-stripe, ...) depend on this neutral port and call `sendMail`; the app registers the concrete transport. The transport is the swappable provider, the way memory/drizzle are for the ORM.

## Usage

```js
// a producer: depend on the port, send a message
import { sendMail } from 'vike-mail'
await sendMail({ to: 'ada@example.com', subject: 'Hi', html: '<p>...</p>' })
```

```js
// the app: register the transport once at server start
import { setMailTransport } from 'vike-mail'
setMailTransport(myResendTransport) // { send(message) -> Promise }
```

Sending goes through vike-queue, so it is background work by default. With the queue's inline driver (the dev default) it runs immediately; with a real queue driver + a worker it moves off the request path. No caller change either way.

## Zero-config default

With no transport registered, a built-in console/outbox transport runs: it records each message to an in-memory outbox (`getOutbox()`) and logs a one-liner. So `sendMail` works with nothing wired (the same role the memory adapter plays for data), and an app upgrades by calling `setMailTransport`.

## Transport contract

```js
const transport = {
  async send({ to, subject, html, text, from }) { /* deliver */ },
}
```

Real transports (Resend, SES, SMTP) implement this and are registered by the app; vike-mail ships only the port and the dev default.
