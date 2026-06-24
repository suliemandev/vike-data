// @vike-data/kit - authoring primitives for vike-data extensions.
//
// These factor out the boilerplate our extensions kept rewriting by hand. Framework-
// agnostic, zero dependencies, no Vike imports: just small helpers over a globalThis
// registry. Modeled on universal-orm's setAdapter/getAdapter/clearAdapter.

/**
 * A runtime PROVIDER registry: the set/get/clear shape extensions use to let the app
 * plug in a live provider (an ORM adapter, a queue driver, a mail/push transport) with
 * an optional zero-config default and validate-on-set. Written once here so the
 * globalThis-Symbol caching is correct in one place (a hand-rolled `Symbol + string`
 * cache key was an easy footgun).
 *
 * @param {object} opts
 * @param {string} opts.name        Stable key (e.g. 'vike-mail.transport'). Two ports
 *                                   with the same name share the same slot.
 * @param {(value:any)=>void} [opts.validate]  Called on set(); should THROW a clear
 *                                   error for an invalid value (so the caller keeps its
 *                                   own message, e.g. "setMailTransport: expected ...").
 * @param {()=>any} [opts.default]   Lazily builds the zero-config default get() returns
 *                                   when nothing is set. Omit for a port with no default
 *                                   (get() then returns null when unset).
 * @returns {{ set:(v:any)=>void, get:()=>any, clear:()=>void }}
 */
export function createPort({ name, validate, default: makeDefault } = {}) {
  if (typeof name !== 'string' || !name) {
    throw new Error('createPort: a non-empty string `name` is required')
  }
  const KEY = Symbol.for(`vike-data.port:${name}`)
  const DEFAULT_KEY = Symbol.for(`vike-data.port:${name}.default`)

  return {
    set(value) {
      if (validate) validate(value) // validate throws on invalid input
      globalThis[KEY] = value
    },
    get() {
      // a set value wins; otherwise the cached lazy default, or null when there is none
      return globalThis[KEY] ?? (makeDefault ? (globalThis[DEFAULT_KEY] ??= makeDefault()) : null)
    },
    clear() {
      delete globalThis[KEY]
      delete globalThis[DEFAULT_KEY]
    },
  }
}

/**
 * A dev capture list: the in-memory "what would have been sent" buffer a dev transport
 * records into (mail/push), kept on globalThis so module duplication can't fork it.
 *
 * @param {string} name  Stable key (e.g. 'vike-mail').
 * @returns {{ get:()=>any[], clear:()=>void, record:(entry:any)=>void }}
 */
export function createOutbox(name) {
  if (typeof name !== 'string' || !name) {
    throw new Error('createOutbox: a non-empty string `name` is required')
  }
  const KEY = Symbol.for(`vike-data.outbox:${name}`)
  const list = () => (globalThis[KEY] ??= [])
  return {
    get: () => list(),
    clear: () => {
      list().length = 0
    },
    record: (entry) => {
      list().push(entry)
    },
  }
}
