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

/**
 * A field-widget registry: the token -> component lookup a schema-driven UI uses to map a
 * column's rendering token (derived from its `.as()` semantic) to the control that renders
 * it. This is the shared MECHANISM behind the schema-driven UI epic: a consumer (vike-admin
 * today; a future vike-landing / vike-email-editor) creates its own per-framework registry by
 * name and reads widgets from it, and an extension teaches EVERY consumer of that framework a
 * new field kind by registering once (e.g. vike-storage registers a `file` upload control), so
 * neither side has to depend on the other.
 *
 * Components are held as OPAQUE values (exactly as createPort holds opaque providers), so kit
 * never renders them and this stays JSX-free and framework-agnostic. Kept on globalThis under a
 * Symbol(name) key so module duplication can't fork the map. A token a registry doesn't know
 * returns undefined, so the caller falls back instead of throwing.
 *
 * @param {string} name  Per-framework key, e.g. 'react' or 'vue'. Two registries created with
 *                       the same name share the same slot.
 * @returns {{ register:(token:string, component:Function)=>Function, get:(token:string)=>Function|undefined, tokens:()=>string[] }}
 */
export function createFieldWidgetRegistry(name) {
  if (typeof name !== 'string' || !name) {
    throw new Error('createFieldWidgetRegistry: a non-empty string `name` is required')
  }
  const KEY = Symbol.for(`vike-data.fieldWidgets:${name}`)
  const map = () => (globalThis[KEY] ??= new Map())
  return {
    // Register (or override) the control for a token. Idempotent: a later call wins, so an app
    // can swap a built-in. Validated so a typo'd token or a non-component fails loudly at
    // registration, not silently at render.
    register(token, component) {
      if (typeof token !== 'string' || token === '') {
        throw new Error('registerFieldWidget(token, component): token must be a non-empty string')
      }
      if (typeof component !== 'function') {
        throw new Error(`registerFieldWidget(${JSON.stringify(token)}, component): component must be a function`)
      }
      map().set(token, component)
      return component
    },
    // The control for a token, or undefined when none is registered (the caller falls back).
    get(token) {
      return map().get(token)
    },
    // The registered tokens, for introspection and tests.
    tokens() {
      return [...map().keys()]
    },
  }
}
