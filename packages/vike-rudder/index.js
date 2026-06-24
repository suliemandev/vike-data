// vike-rudder — the Rudder binding for vike-data. It turns a `@rudderjs/database`
// connection into the universal-orm adapter, so every extension (vike-stripe, vike-auth, ...)
// writes to the real database through the neutral repository. The app calls registerRudder()
// once, in Vike's onCreateGlobalContext hook:
//
//   // app: +onCreateGlobalContext.js
//   import { registerRudder } from 'vike-rudder'
//   export default async () => { await registerRudder({ driver: 'pg', url: process.env.DATABASE_URL }) }
//
// `NativeAdapter.make({ driver, url })` builds a connection straight from a URL WITHOUT the
// Rudder framework bootstrap — that is what makes Rudder's data layer usable from a plain Vike
// app. Why a runtime hook and not `extends: [...]`: a live connection can't travel through
// Vike's (serialized, pointer-based) config; the connection is the app's at runtime, so the
// app owns the one-line hook and vike-rudder is the seam to @universal-orm/core's registry.
// Same idea as vike-drizzle and what Rom described: the app installs ONE adapter and hands it
// the connection.
import { setAdapter, getAdapter } from '@universal-orm/core'
import { createRudderAdapter } from '@universal-orm/rudder'
import { NativeAdapter } from '@rudderjs/database/native'

export { createRudderAdapter }

// Register Rudder as the runtime adapter. `config` is either a ready NativeAdapter or a
// `{ driver, url, ... }` NativeConfig that this builds one from (async — making a connection
// can be). Idempotent: the first registration wins (pass `{ override: true }` to replace), so
// duplicate hook evaluation (pointer-import / dev HMR) can't fork the adapter.
export async function registerRudder(config, { override = false } = {}) {
  if (!config) throw new Error('[vike-rudder] registerRudder requires a NativeAdapter or a { driver, url } config')
  const existing = getAdapter()
  if (existing && !override) return existing
  const native = config instanceof NativeAdapter ? config : await NativeAdapter.make(config)
  const adapter = createRudderAdapter(native)
  setAdapter(adapter)
  return adapter
}
