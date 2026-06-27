# Authoring a vike-data extension

A practical recipe for building one of these extensions. For the layering and the
mechanics behind each seam, see [Architecture.md](Architecture.md); for how users
customize an installed extension, see [CUSTOMIZATION.md](CUSTOMIZATION.md). This doc is
the "how do I build one" guide.

## The idea in one paragraph

An extension OWNS a slice of an app (auth owns users + sessions; queue owns background
jobs; mail owns sending) and exposes it through a few consistent seams so other
extensions and the app COMPOSE with it without importing it directly. You declare intent
(a table, a config point, a route) and the framework derives the rest. Two composition
styles run through everything: **build-time cumulative config** (extensions contribute
data, the app picks) and **runtime ports** (one extension provides a live thing, others
read it). Pick the right one and the rest falls into place.

## Anatomy

A typical extension is one package:

```
my-ext/
  +config.js        # the Vike config seam: self-install, cumulative points, schema, middleware
  index.js          # the framework-agnostic core (runtime ports, the public API)
  schema.js         # the table(s) this extension owns (if any)
  middleware.js     # server endpoints, if any (a universal middleware)
  react/  vue/      # per-framework UI subpaths, if any
  package.json      # exports map: '.', './config', subpaths
```

Not every extension needs every file. A pure data extension is just `+config.js` +
`schema.js`. A channel (mail/push) is `index.js` (a port) + `+config.js`. The UI tier
adds `react/` + `vue/` subpaths.

## The seams

### 1. Self-install + cumulative config

Declare a cumulative contribution point with `meta`, give it an empty default, and
self-install your base so one install pulls the chain. Contributions from every installed
extension compose; the app picks with a sibling key.

```js
// +config.js
export default {
  name: 'my-ext',
  // self-install dependencies via pre-serialized pointer-import strings
  extends: ['import:@vike-data/vike-schema/config:default'],
  meta: {
    // a cumulative point others (and the app) contribute to
    myThings: { env: { server: true, client: true }, cumulative: true },
  },
  myThings: [],
}
```

Non-serializable values (a live component, a function, a computed schema) cannot be
inlined into config, so pass them as **pointer-import strings** (`'import:my-ext/x:default'`)
or from a dedicated config file, which Vike loads via Vite.

### 2. Own your tables (the Stem pattern)

Declare tables once through the neutral schema DSL and contribute them to the cumulative
`schemas` point. They derive to Prisma / Drizzle / the Rudder engine; you write no
ORM-specific code.

```js
// schema.js
import { defineSchema } from '@vike-data/vike-schema/schema'

export const myThingsSchema = defineSchema('my_things', (t) => {
  t.uuid('id').primary()
  t.uuid('user_id').references('users.id', { onDelete: 'cascade' }) // compose on auth's table
  t.string('label')
  t.timestamps()
})
```

```js
// +config.js
import { myThingsSchema } from './schema.js'
export default {
  name: 'my-ext',
  extends: ['import:@vike-data/vike-schema/config:default'],
  schemas: [myThingsSchema],
}
```

Read and write through the neutral repository (`@universal-orm/core`'s `getAdapter()`),
never an ORM directly. The app registers one adapter; every extension shares it.

**Owning a row: two axes, both build-time data.** When your table FKs to the auth subject,
resolve the FK target instead of hardcoding `users` so it follows the app's configuration:

- **Which subject (rename).** Resolve the subject table with `resolveSubject()` (vike-auth)
  so a renamed `users` table is followed automatically; a named-guard binding points the same
  FK at another user table (`admins`/`clients`). The FK **column** stays `user_id`; only its
  **target table** changes.
- **Which kind of owner (the owner contract, #250).** Let the app rebind the row to a different
  *kind* of owner (an organization, not a user) with `@vike-data/kit`'s `resolveOwner(defaultTable, binding)`
  → `{ ownerTable, ownerColumn }`. This is the [vike-stripe](packages/vike-stripe) `segment` move
  lifted into one shared vocabulary. The column itself swaps (`user_id` → `organization_id`). Default
  binding = the auth subject on `user_id`, byte-for-byte the single-owner table.

```js
// schema.js — a config-aware (computed) schema that follows both axes
import { resolveSubject } from 'vike-auth/subject'
import { resolveOwner } from '@vike-data/kit'

export function myThingsSchemas(config) {
  const { ownerTable, ownerColumn } = resolveOwner(resolveSubject().users, config?.myThingOwner)
  return [defineSchema('my_things', (t) => {
    t.uuid('id').primary()
    t.uuid(ownerColumn).references(`${ownerTable}.id`, { onDelete: 'cascade' })
    t.timestamps()
  })]
}
```

`vike-storage`, `vike-push`, and `vike-notifications` are the reference consumers; see
[@vike-data/kit](packages/kit/README.md#resolveowner) for the contract and each package's
"Owned by a team" README section for the matching runtime env (`VIKE_<PKG>_OWNER_COLUMN`/`_FROM`).
Declare the config key in `+config.js` `meta` (an undeclared config key is rejected by Vike), the
same way vike-stripe declares `segment`.

### 3. The runtime port (a live provider)

When the app needs to plug in a LIVE thing (a transport, a driver, a connection), use a
runtime port, not config (live code can't be serialized). `@vike-data/kit`'s `createPort`
is the `setAdapter`/`getAdapter` shape, written once:

```js
// index.js
import { createPort } from '@vike-data/kit'

const sink = createPort({
  name: 'my-ext.sink',
  validate: (s) => { if (typeof s?.write !== 'function') throw new Error('setSink: expected a sink with a write() method') },
  default: () => consoleSink,   // optional zero-config default (see #4)
})

export const setSink = (s) => sink.set(s)   // the app calls this once at server start
export const getSink = () => sink.get()     // your code reads the live provider here
```

A port holds ONE provider. When you instead need MANY of a kind, each keyed by name and
dispatched over (channels, jobs), reach for a runtime registry (seam 10), not a port.

### 4. Optional-runtime defaults

A port's `default` makes the extension work with NO wiring: a dev/console/in-memory
provider that the app upgrades by registering a real one. This is why every extension
runs zero-config and "just works" in dev (the memory ORM adapter, the inline queue
driver, the console mail/push transports all follow this).

### 5. Server endpoints (a universal middleware)

Own routes as a universal middleware (server-agnostic: Hono / Express / Cloudflare / the
Vike dev server). Contribute it through the cumulative `middleware` config.

```js
// middleware.js
import { enhance, MiddlewareOrder } from '@universal-middleware/core'

export function createMyMiddleware() {
  async function mw(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/my-ext/')) return // fall through to Vike
    // ... handle the route, return a Response
  }
  return enhance(mw, { name: 'my-ext', order: MiddlewareOrder.AUTHENTICATION })
}
export default createMyMiddleware()
```

```js
// +config.js
export default { name: 'my-ext', middleware: 'import:my-ext/middleware:default' }
```

Vike dedupes identical contributions by extension identity ([vikejs/vike#3354](https://github.com/vikejs/vike/issues/3354)),
so a middleware self-installed by several extensions runs once per request, no
idempotency guard needed. To read the signed-in user in an endpoint, use vike-auth's
server seam (`resolveSessionUser(request)`); to set values on `pageContext` for the
render path, return `{ ...context, value }` from a universal middleware.

### 6. Per-framework UI (subpaths)

The core stays framework-agnostic; the UI lives in `react/` and `vue/` subpaths of the
SAME package, referenced from config by pointer-import. A page just installs the
extension and the UI appears (a `Layout`/`Wrapper`, a contributed page, a control). See
any of vike-auth / vike-themes / vike-push for the React + Vue twin layout, and note the
Vue specifics (no `Wrapper` config: use the cumulative `Layout`; inject raw CSS with
`h('style', { innerHTML })`).

### 7. Guarded RPCs (the Telefunc `can()` seam)

For authorization, reuse the same `can(user, permission)` that guards a page (vike-rbac).
A guarded telefunction runs the same check an admin page would, because the signed-in,
role-enriched user is on the Telefunc context. See `vike-rbac/telefunc`.

### 8. Eject for the long tail

Expose only the few coarse choices an app makes constantly; make everything finer-grained
an **eject** (copy the source into the app and own it), rather than a config knob per edge
case. See [CUSTOMIZATION.md](CUSTOMIZATION.md).

### 9. Cross-extension integration (one extension teaches another a new capability)

Sometimes one extension wants to plug a capability into another: vike-storage teaches
vike-admin to render `.as('file')` columns as an uploader. The glue imports from BOTH
packages, so *something* must depend on both. The rule: **neither core may depend on the
other.** A hard dep either way over-couples. `vike-admin -> vike-storage` would force
every admin install (users, orders, settings, no file column anywhere) to pull storage's
`uploads` table + endpoint; `vike-storage -> vike-admin` would stop storage being usable
headless (avatars, attachments, an API). So the integration is **opt-in** and lives in a
**leaf** that depends on both, never in either core.

The way to satisfy that rule without coupling cores is **dependency inversion through a
shared registry in `@vike-data/kit`**: neither side imports the other; both depend on kit.
The provider registers its capability into kit's registry; the consumer reads from the same
registry. `@vike-data/kit` exposes `createFieldWidgetRegistry(name)` for exactly this (a
per-framework, token to component map, holding components as opaque values the way
`createPort` holds opaque providers). A column declared `.as('file')` renders an uploader in
EVERY consumer of that registry (vike-admin today; a future `vike-landing` /
`vike-email-editor`), with no per-consumer bridge.

The registration must run in the page bundle in BOTH envs, so the provider exposes it as a
passthrough `Layout` and contributes it through the cumulative `Layout` seam (an `extends`
target must be a `+config.js`, so the leaf is a tiny config in the provider's framework
subpath, never in its core):

```js
// vike-storage/react/+config.js  - the leaf; pulled in by one `extends` entry (storageReactExt)
export default {
  name: 'vike-storage-react',
  Layout: 'import:vike-storage/react/FieldWidgetRegister:default',
}

// vike-storage/react/FieldWidgetRegister.jsx  - registers on import, renders children unchanged
import { createFieldWidgetRegistry } from '@vike-data/kit'
import { FileField } from './FileField.jsx'
createFieldWidgetRegistry('react').register('file', FileField)   // into the SHARED registry
export default function FieldWidgetRegister({ children }) { return children }
```

```js
// the consumer (vike-admin/react/widget-registry.js) reads the SAME registry
import { createFieldWidgetRegistry } from '@vike-data/kit'
const registry = createFieldWidgetRegistry('react')   // same name -> same map (kit keys it on globalThis)
export const getFieldWidget = (token) => registry.get(token)
```

vike-storage depends only on kit (already a dep); it lists vike-admin nowhere, and vike-admin
lists vike-storage nowhere. A new consumer gets `.as('file')` for free, and a new field kind
(rich-text, map, color) registers once and every consumer sees it. The framework-specific
built-in widgets and the both-envs registration stay in the framework packages; kit holds only
the mechanism.

This registry was promoted into kit from vike-admin (#185) once a second consumer of the
schema became foreseeable - the trigger for extracting a shared mechanism, the same discipline
that delayed `createPort` until it had repeated. **Don't anticipate the next one speculatively,
and never reach for a per-consumer bridge** (`vike-storage/react-cms` + a vike-admin peer) when
the shared registry already covers it (that path makes the lowest layer accumulate knowledge of
every higher one: N consumers x M providers = NxM bridges). (Open follow-up: have the
create-vike scaffolder auto-add `storageReactExt` when both extensions are selected, keeping
the explicit `extends` entry as the manual path.)

### 10. Runtime registries (many providers) + the app-wired adapter

A runtime port (seam 3) holds ONE live provider. Some seams instead hold MANY, each
keyed by name, and a dispatcher fans out over all of them: vike-queue's job registry,
and vike-notifications' channel registry (`mail`, `push`, `database`, ...). The shape is
a keyed registry rather than a single `set`/`get`:

```js
registerChannel({ name, send(notifiable, rendered) })   // add one of many
getChannel(name) / getChannels()                        // read one / all
```

An official channel is a thin SIBLING package that self-registers on import, so the core
stays closed for modification (adding a channel is a new package, never an edit). It
depends on both the registry's package and the transport, and neither of those depends on
it (the universal-orm adapter pattern). `vike-notifications-mail` is the whole shape:

```js
// vike-notifications-mail/index.js  - a separate package; importing it self-registers `mail`
import { registerChannel, routeFor } from 'vike-notifications'
import { sendMail } from 'vike-mail'

export const mailChannel = {
  name: 'mail',
  // `rendered` is the notification's toMail(user) CONTENT; the recipient is resolved from
  // the notifiable through routeFor (the routing seam), never read off the content.
  async send(notifiable, rendered) {
    return sendMail({ ...rendered, to: routeFor(notifiable, 'mail') })
  },
}
registerChannel(mailChannel)   // self-register on import: install the package and `via: ['mail']` works
```

**The app-wired escape hatch.** `registerChannel` is the same seam whether a package or
the app calls it, so a one-off channel an app does not want to package is a first-class
path with no extra support: register it directly at server start (where the app registers
its ORM adapter and queue driver), and it works exactly like an official one.

```js
// the app's server bootstrap (onCreateGlobalContext) - a custom Slack channel, no package
import { registerChannel } from 'vike-notifications'

registerChannel({
  name: 'slack',
  // matched by convention to the notification's toSlack(user) renderer; `via` must include 'slack'.
  async send(notifiable, rendered) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rendered.text }),
    })
  },
})
```

A notification opts a recipient into the channel by listing it in `via(user)` and renders
for it with the matching `to<Name>(user)` method (`slack` -> `toSlack`); an unregistered or
unrendered channel is skipped, not an error. **Package it** when the channel is reusable
across apps (publish a sibling adapter like the mail/push ones); **app-wire it** for an
app-specific one-off. Same seam either way, so the choice is about distribution, not
capability.

## The decision that matters most: config vs port

| Use a **cumulative config point** when... | Use a **runtime port** when... |
|---|---|
| the contribution is DATA (a schema, a theme, a message map, a nav item, a permission) | the contribution is a LIVE provider (an adapter, a driver, a transport, a connection) |
| it is known at build time and composes across extensions | the app registers ONE of it at server start and others read it |
| Vike can serialize it (or it's a pointer-import) | it's live code that can't be serialized |

Most "extensions contribute, the app picks" cases are config. Most "the app plugs in a
backend" cases are a port. When unsure: is it data that composes (config) or a single
live thing the app supplies (port)? When it is live but the app (or a sibling) plugs in
MANY of a kind keyed by name, it is a runtime registry (seam 10), the `many` variant of a
port.

## A minimal worked example

A tiny "audit log" extension: owns a table, exposes a `record()` that writes through a
swappable sink, and works zero-config in dev.

```js
// schema.js
import { defineSchema } from '@vike-data/vike-schema/schema'
export const auditSchema = defineSchema('audit_log', (t) => {
  t.uuid('id').primary()
  t.string('action')
  t.string('detail').nullable()
  t.timestamps()
})

// index.js
import { createPort } from '@vike-data/kit'
import { getAdapter } from '@universal-orm/core'
import { randomUUID } from 'node:crypto'

const consoleSink = { async write(entry) { console.log('[audit]', entry.action) } }
const sink = createPort({
  name: 'vike-audit.sink',
  validate: (s) => { if (typeof s?.write !== 'function') throw new Error('setAuditSink: expected a sink with write()') },
  default: () => consoleSink,
})
export const setAuditSink = (s) => sink.set(s)

export async function record(action, detail) {
  const adapter = getAdapter()
  if (adapter) {
    const ts = new Date().toISOString()
    await adapter.insert('audit_log', { id: randomUUID(), action, detail: detail ?? null, created_at: ts, updated_at: ts })
  }
  await sink.get().write({ action, detail })
}

// +config.js
import { auditSchema } from './schema.js'
export default {
  name: 'vike-audit',
  extends: ['import:@vike-data/vike-schema/config:default'],
  schemas: [auditSchema],
}
```

Install it and `record('user.login')` works (logging in dev, persisting once an adapter
is registered). Register a real sink (`setAuditSink(myDatadogSink)`) and it ships logs,
with no change to the call site. That is the whole model in ~30 lines.

## Checklist

- [ ] One concern, owned end to end.
- [ ] Tables via `defineSchema`, contributed to `schemas`; reads/writes through `getAdapter()`.
- [ ] Live providers via a `createPort` runtime port, with a zero-config `default`.
- [ ] Data contributions via a cumulative `meta` point + pointer-imports for non-serializable values.
- [ ] Endpoints as a universal middleware on the cumulative `middleware` config.
- [ ] Per-framework UI in `react/` + `vue/` subpaths; the core stays framework-agnostic.
- [ ] Authorization through vike-rbac's `can()` (pages and RPCs alike).
- [ ] Cross-extension integration through a shared `@vike-data/kit` registry (provider registers, consumer reads); neither core depends on the other; no per-consumer bridge.
- [ ] A small config surface; eject for the long tail.
