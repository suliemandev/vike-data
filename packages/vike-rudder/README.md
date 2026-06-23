# vike-rudder

The Rudder binding for vike-data. Install it and a [`@rudderjs/database`](https://www.npmjs.com/package/@rudderjs/database) connection becomes the [universal-orm](../universal-orm) adapter, so every extension (vike-stripe, vike-auth, ...) writes to your database with no manual `setAdapter` wiring. The twin of [`vike-drizzle`](../vike-drizzle).

`registerRudder()` builds the connection from a URL via `NativeAdapter.make({ driver, url })`, **without the Rudder framework bootstrap**, which is what makes Rudder's data layer usable from a plain Vike app.

## Install

```bash
pnpm add vike-rudder @rudderjs/database
# plus the driver you use: better-sqlite3 | postgres | mysql2
```

## Usage

Register the adapter once, in Vike's `onCreateGlobalContext` hook (it runs at server start):

```js
// pages/+onCreateGlobalContext.js
import { registerRudder } from 'vike-rudder'

export default async () => {
  await registerRudder({ driver: 'pg', url: process.env.DATABASE_URL })
}
```

You can also hand it a ready `NativeAdapter` instead of a `{ driver, url }` config:

```js
import { NativeAdapter } from '@rudderjs/database/native'
await registerRudder(await NativeAdapter.make({ driver: 'sqlite', url: ':memory:' }))
```

Registration is idempotent (the first call wins; pass `{ override: true }` to replace), so duplicate hook evaluation cannot fork the adapter.

## Why a runtime hook and not `extends: [...]`

A live connection cannot travel through Vike's serialized, pointer-based config, and `extends` only accepts module pointer-imports, not a constructed object. The connection is the app's at runtime, so the app owns the one-line hook and vike-rudder is the seam between it and `@universal-orm/core`'s adapter registry. Same idea as vike-drizzle: the app installs one adapter and hands it the connection.

## Note on bundling

`@rudderjs/database` and its native driver (e.g. `better-sqlite3`) are node-only. Keep them out of the client bundle by marking them external in the app's Vite config (the `+onCreateGlobalContext` hook that references them is server-only):

```js
// vite.config.js
build: { rollupOptions: { external: [/^@rudderjs\/database/, 'better-sqlite3'] } },
ssr: { external: ['@rudderjs/database', 'better-sqlite3'] },
```
