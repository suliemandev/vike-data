// The default auth instance the Vike binding wires up: an in-memory store + the
// auth core. Both the middleware and the onCreatePageContext hook import THIS
// module so they share one store within a process.
//
// It is cached on globalThis so duplicate module evaluation (different pointer
// imports, dev HMR) can't fork the store into two — every code path sees the
// same sessions and login tokens.
import { createAuth } from './auth.js'
import { createMemoryStore } from './store.js'

const KEY = Symbol.for('vike-auth.instance')

if (!globalThis[KEY]) {
  globalThis[KEY] = createAuth({ store: createMemoryStore() })
}

/** @type {ReturnType<typeof createAuth>} */
export const auth = globalThis[KEY]
