// One-time server startup: register the universal-orm adapter + the vike-ai provider,
// build the notes repository, and seed the demo user through vike-auth's store. Runs in
// server/index.ts before the HTTP server accepts requests, because the /api/* handlers
// run outside Vike's render lifecycle (so they can't rely on +onCreateGlobalContext).
//
// This is the composition the benchmark measures: vike-auth owns identity + sessions, the
// universal ORM owns the data layer, vike-ai owns the AI seam. The app wires them, it does
// not reimplement them.
import { createRepository, getAdapter, setAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { mergeSchemas } from '@vike-data/universal-schema'
import { createAuth, createStore } from 'vike-auth'
import { setAiProvider } from 'vike-ai'
import { notesSchema } from './schema.js'
import { summaryOf } from './ai.js'

export const SEED_EMAIL = 'demo@example.com'
export const SEED_PASSWORD = 'password'

// Headless auth core over vike-auth's composed store. The store resolves the registered
// adapter lazily per call, so users + sessions persist through the SAME data layer as
// `notes`. We use the core directly (not the default guard instance) to stay clear of the
// Vike-config wiring the REST baseline does not need.
export const auth = createAuth({ store: createStore() })

let repo: ReturnType<typeof createRepository> | null = null
/** The notes repository, built once the adapter is registered. */
export function db() {
  if (!repo) repo = createRepository(mergeSchemas([notesSchema]), getAdapter())
  return repo
}

// `notes.id` is a number per the HTTP contract; the memory adapter does not auto-assign, so
// the app mints ids. Fresh on each boot, in lockstep with the in-memory store.
let nextId = 1
export function nextNoteId(): number {
  return nextId++
}

let booted = false
export async function bootstrap(): Promise<void> {
  if (booted) return
  booted = true

  setAdapter(createMemoryAdapter())

  // The deterministic stub provider on vike-ai's port: no network, no key, fully
  // reproducible (the baseline summary is the first sentence of the body). A real provider
  // (vike-ai-gemstack over @gemstack/ai-sdk) is a one-line swap, the AI twin of swapping
  // the memory adapter for a real DB.
  setAiProvider({
    async generate({ prompt, model, provider }) {
      return { text: summaryOf(String(prompt ?? '')), model: model ?? 'stub', provider: provider ?? 'stub' }
    },
    async chat({ messages, model, provider }) {
      const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
      const text = summaryOf(lastUser ? String(lastUser.content) : '')
      return { text, message: { role: 'assistant', content: text }, model: model ?? 'stub', provider: provider ?? 'stub' }
    },
  })

  // Seed the single demo user through vike-auth's store (passwordless by design; the
  // password the REST contract checks is benchmark-fixed, see api.ts).
  const existing = await auth.store.findUserByEmail(SEED_EMAIL)
  if (!existing) await auth.store.createUser({ email: SEED_EMAIL })
}
