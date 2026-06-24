# @vike-data/kit

Authoring primitives for vike-data extensions: the small, framework-agnostic helpers our extensions kept rewriting by hand. Zero dependencies, no Vike imports. This is a building block (like `@universal-orm/core`), not an extension an app installs.

## `createPort`

The runtime provider registry every channel/adapter needs: let the app plug in a live provider (an ORM adapter, a queue driver, a mail/push transport), fall back to a zero-config default, validate on set. Written once here so the globalThis-Symbol caching is correct in one place.

```js
import { createPort } from '@vike-data/kit'

const transport = createPort({
  name: 'vike-mail.transport',          // stable key; same name -> same slot
  validate: (t) => {                     // throws a clear error on invalid input
    if (typeof t?.send !== 'function') throw new Error('setMailTransport: expected a transport with a send() method')
  },
  default: () => consoleTransport,       // lazy zero-config default (omit for none -> get() returns null)
})

export const setMailTransport = (t) => transport.set(t)
export const getMailTransport = () => transport.get()   // the set value, else the cached default
export const clearMailTransport = () => transport.clear()
```

This is the same shape as universal-orm's `setAdapter` / `getAdapter` / `clearAdapter`, generalized.

## `createOutbox`

The in-memory "what would have been sent" buffer a dev transport records into (mail/push), kept on globalThis so module duplication can't fork it.

```js
import { createOutbox } from '@vike-data/kit'

const outbox = createOutbox('vike-mail')
outbox.record(message)   // a dev transport captures here
outbox.get()             // inspect (tests / a dev UI)
outbox.clear()           // reset (tests)
```

## Used by

`vike-queue` (the driver port), `vike-mail` and `vike-push` (the transport ports + dev outboxes). A new channel or adapter writes a few lines instead of re-deriving the registry.
