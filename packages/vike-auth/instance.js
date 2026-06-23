// The default auth instance the Vike binding wires up: an in-memory store + the
// auth core. Both the middleware and the onCreatePageContext hook import THIS
// module so they share one store within a process.
//
// It is cached on globalThis so duplicate module evaluation (different pointer
// imports, dev HMR) can't fork the store into two — every code path sees the
// same sessions and login tokens.
import { createAuth } from './auth.js'
import { createStore } from './composed-store.js'

const KEY = Symbol.for('vike-auth.instance')

if (!globalThis[KEY]) {
  // The default store persists through the app's universal-orm adapter when one is
  // registered (so auth shares the users/sessions tables with the rest of the app),
  // and falls back to in-memory when none is — see composed-store.js.
  globalThis[KEY] = createAuth({ store: createStore() })
}

/** @type {ReturnType<typeof createAuth>} */
export const auth = globalThis[KEY]
