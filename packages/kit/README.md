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

## `resolveOwner`

The shared **owner contract** (#250): the one vocabulary behind "let this extension's rows be owned by an *organization*, not just the auth user." An owned-row extension passes its default owner table (its resolved auth subject) and the app's opt-in binding; it gets back `{ ownerTable, ownerColumn }` to build the FK from.

```js
import { resolveOwner } from '@vike-data/kit'

// no binding -> the single-owner default: { ownerTable: 'users', ownerColumn: 'user_id' }
resolveOwner('users')

// app opts in to org ownership -> { ownerTable: 'organizations', ownerColumn: 'organization_id' }
resolveOwner('users', { table: 'organizations', column: 'organization_id' })
```

It is the OWNER axis, **orthogonal** to a subject *rename*: a rename (vike-auth's `resolveSubject`, or a named guard) changes which table the fixed `user_id` FK targets; an owner binding can ALSO swap the **column** to a different *kind* of owner. This is exactly the move [vike-stripe's `segment`](../vike-stripe/README.md) makes flipping `user_id`/`users` ↔ `organization_id`/`organizations` — lifted here so the owned-row extensions express "who owns this row" with ONE vocabulary instead of re-deriving stripe's `segment`/`subjectColumn` per package.

`resolveOwner` is **pure** (no env, no globals): the build half. Each consumer adds the runtime half — `VIKE_<PKG>_OWNER_COLUMN` (where to write/scope the owner id) and `VIKE_<PKG>_OWNER_FROM` (which field of the signed-in user holds it, e.g. `current_organization_id`) — and resolves a `403 no-owner` when a signed-in user has no org. A blank table/column falls through to the default, and the column defaults to `DEFAULT_OWNER_COLUMN` (`user_id`), so a consumer that passes no binding stays byte-for-byte its single-owner self. See the "Owned by a team" section in [vike-storage](../vike-storage/README.md#owned-by-a-team-not-a-user-storageowner-250), [vike-push](../vike-push/README.md), and [vike-notifications](../vike-notifications/README.md) for the worked end-to-end binding, and [AUTHORING.md](../../AUTHORING.md#2-own-your-tables-the-stem-pattern) for the authoring pattern.

## Used by

`vike-queue` (the driver port), `vike-mail` and `vike-push` (the transport ports + dev outboxes), and `vike-storage` / `vike-push` / `vike-notifications` (the `resolveOwner` owner contract). A new channel or adapter writes a few lines instead of re-deriving the registry.
