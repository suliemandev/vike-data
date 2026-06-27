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
 * The zero-config "console + outbox" transport a channel falls back to when no real transport
 * is registered: it records each delivery to an in-memory outbox (for tests + a dev UI) and
 * logs a one-line summary. Bundles createOutbox with the record-and-log pattern mail/push had
 * each duplicated; register `transport` as a port's `default` and re-export `getOutbox` /
 * `clearOutbox` under the channel's own names.
 *
 * `send` is variadic so it fits either transport contract (mail's `send(message)`, push's
 * `send(subscription, payload)`): `entry` maps the send args to the outbox record, `line` maps
 * them to the log string (stringify user-influenced values so a newline can't forge a log line).
 *
 * @param {object} opts
 * @param {string} opts.name               Outbox key (e.g. 'vike-mail').
 * @param {(...args:any[])=>any} opts.entry What to record in the outbox for one send().
 * @param {(...args:any[])=>string} opts.line The one-line log summary for one send().
 * @returns {{ getOutbox:()=>any[], clearOutbox:()=>void, transport:{ send:(...args:any[])=>Promise<void> } }}
 */
export function createDevTransport({ name, entry, line } = {}) {
  const outbox = createOutbox(name) // validates `name`
  return {
    getOutbox: () => outbox.get(),
    clearOutbox: () => outbox.clear(),
    transport: {
      async send(...args) {
        outbox.record(entry(...args))
        // eslint-disable-next-line no-console
        console.log(line(...args))
      },
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

/**
 * A configurable-SUBJECT resolver: the shared mechanism behind an extension's "rename my
 * table(s)/column(s) by config" knob. vike-auth (`resolveSubject`) and vike-teams
 * (`resolveTeamSubject`) both resolve a fixed set of named fields with identical rules, so
 * the precedence + blank-guard lives here once instead of being re-handwritten per package.
 *
 * Resolution per field: explicit `overrides[field]` > `env[envKeys[field]]` > `defaults[field]`.
 * A blank/whitespace-only override or env value is treated as UNSET (falls through), so an
 * empty `FOO_TABLE=` in a .env never produces a nameless table. A field with NO entry in
 * `envKeys` is resolved from override/default only (never env) - the way a reserved column map
 * is carried for shape stability without shipping an env var that silently does nothing.
 *
 * @param {Record<string,string>} defaults  The field -> default-value map (and the set of
 *                                           fields the resolver returns). Frozen internally.
 * @param {Record<string,string>} [envKeys] The field -> env-var-name map. Fields absent here
 *                                           are default/override-only.
 * @returns {(overrides?:Record<string,string>, env?:Record<string,string|undefined>)=>Record<string,string>}
 */
export function createSubjectResolver(defaults, envKeys = {}) {
  if (defaults == null || typeof defaults !== 'object') {
    throw new Error('createSubjectResolver(defaults, envKeys): `defaults` must be an object')
  }
  const frozen = Object.freeze({ ...defaults })
  return function resolve(overrides = {}, env = (typeof process !== 'undefined' ? process.env : {})) {
    const out = {}
    for (const field of Object.keys(frozen)) {
      const override = overrides[field]
      if (override != null && String(override).trim() !== '') {
        out[field] = String(override).trim()
        continue
      }
      const envKey = envKeys[field]
      const fromEnv = envKey ? env[envKey] : undefined
      out[field] = fromEnv != null && String(fromEnv).trim() !== '' ? String(fromEnv).trim() : frozen[field]
    }
    return out
  }
}

/**
 * The canonical OWNER column name (#250): an owned-row extension (vike-storage / vike-push /
 * vike-notifications) FKs each row to a single owner by this column unless the app opts into a
 * different kind of owner.
 */
export const DEFAULT_OWNER_COLUMN = 'user_id'

/**
 * Resolve an OWNER binding - `{ ownerTable, ownerColumn }` - the shared contract behind "let this
 * extension's rows be owned by an organization, not just the auth user" (#250). It is the OWNER
 * axis, orthogonal to subject RENAME (createSubjectResolver / resolveSubject): a rename changes
 * which table the fixed `user_id` FK targets; an owner binding can ALSO swap the COLUMN to a
 * different kind of owner - the way vike-stripe's `segment` flips `user_id`/`users` <->
 * `organization_id`/`organizations`. Lifting it here means the three owned-row extensions express
 * "who owns this row" with ONE vocabulary instead of re-deriving stripe's `segment`/`subjectColumn`
 * per package.
 *
 * Pure (no env, no globals) so it composes with whatever subject/guard resolution the extension
 * already does: the extension passes its resolved default owner table (the auth subject) and the
 * app's opt-in binding. A blank/whitespace table or column falls through to the default; the
 * column defaults to `user_id`, so an extension that passes no binding stays byte-for-byte its
 * single-owner self.
 *
 * @param {string} defaultTable  The extension's default owner table (its resolved auth subject).
 * @param {{ table?:string, column?:string }} [binding]  The app's opt-in owner override.
 * @returns {{ ownerTable:string, ownerColumn:string }}
 */
export function resolveOwner(defaultTable, binding = {}) {
  const clean = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : undefined)
  return {
    ownerTable: clean(binding?.table) ?? defaultTable,
    ownerColumn: clean(binding?.column) ?? DEFAULT_OWNER_COLUMN,
  }
}

/**
 * The RUNTIME half of the owner contract (#250) - the request-time complement to the build-time
 * `resolveOwner`. The three owned-row extensions (vike-storage / vike-notifications / vike-push)
 * resolve "which column is the row owned by" and "what owner id does this request carry" the same
 * way at runtime, differing only in the env-var name and how they find the signed-in user's
 * subject table. Lifting that shared body here keeps the rule in ONE place.
 *
 * Like `resolveOwner`, these stay pure: they read no env and touch no global registry themselves.
 * The caller passes the already-read env value (e.g. `process.env.VIKE_STORAGE_OWNER_COLUMN`) and,
 * for the id resolver, the resolved subject table + the orm adapter - so kit composes with whatever
 * guard/subject resolution the consumer already does and never needs to depend on vike-auth or the
 * orm core.
 */

/**
 * The column an owned row is keyed by. `value` is the raw `VIKE_<X>_OWNER_COLUMN` env value (or
 * undefined); a blank/whitespace value falls through to `defaultColumn` (`user_id` by default), so
 * an extension that sets no binding stays byte-for-byte its single-owner self.
 *
 * @param {string|undefined} value  The raw env value (the app's opt-in owner column).
 * @param {string} [defaultColumn]  The fallback column. Defaults to `DEFAULT_OWNER_COLUMN`.
 * @returns {string}
 */
export function resolveOwnerColumn(value, defaultColumn = DEFAULT_OWNER_COLUMN) {
  return value != null && value.trim() !== '' ? value.trim() : defaultColumn
}

/**
 * The owner id a request carries. By default the owner IS the signed-in user, so the owner id is
 * `user.id`. When the app binds the row to a different owner (e.g. an organization) it sets
 * `VIKE_<X>_OWNER_FROM` to the subject-row field that holds the owner id (e.g.
 * `current_organization_id`); that field lives on the full subject row, not the normalized
 * `{ id, email, name }`, so we load the row by id and read it. Returns null when the user has no
 * such owner (e.g. belongs to no org) - the caller answers 403, never owning a row by a
 * missing/blank owner.
 *
 * @param {{ id: any }} user  The signed-in user (normalized subject).
 * @param {{ from: string|undefined, subjectTable: string, adapter: { find: Function }|null }} opts
 *   `from` is the raw `VIKE_<X>_OWNER_FROM` env value; `subjectTable` is the table the user lives
 *   in (the bound guard's subject, or the default `users`); `adapter` is the orm adapter.
 * @returns {Promise<any|null>}
 */
export async function resolveOwnerId(user, { from, subjectTable, adapter } = {}) {
  if (!from || from.trim() === '' || from.trim() === 'id') return user.id
  if (!adapter) return null
  const row = (await adapter.find(subjectTable, { id: user.id }))[0]
  const ownerId = row?.[from.trim()]
  return ownerId != null && ownerId !== '' ? ownerId : null
}

/**
 * A JSON `Response` with the `application/json` content type - the shared shape the extension
 * middlewares return. `body` is JSON-serialized.
 *
 * @param {number} status
 * @param {unknown} body
 * @returns {Response}
 */
export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Parse a request's JSON body, returning null instead of throwing on a malformed/empty body - the
 * shared "read the POST body, treat garbage as absent" helper the middlewares use.
 *
 * @param {Request} request
 * @returns {Promise<any|null>}
 */
export async function readJsonSafe(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}
