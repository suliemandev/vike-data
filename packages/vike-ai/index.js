// vike-ai - the neutral AI PORT.
//
// The AI twin of @universal-orm/core: it owns a neutral provider contract + a runtime
// registry for the concrete provider, but ships no real provider. App code calls
// generate() / chat() / stream(); the APP registers the provider (an echo provider in
// dev, Rudder AI / a Vercel AI SDK provider / a direct Anthropic provider in prod) with
// setAiProvider, exactly like the app picks a universal-orm adapter with setAdapter.
//
//   app code:  import { generate } from 'vike-ai'; const { text } = await generate({ prompt })
//   app:       import { setAiProvider } from 'vike-ai'; setAiProvider(rudderAi(...))
//
// Two levels of provider-agnosticism live at different layers (see #175):
//   - vike-ai is agnostic over AI IMPLEMENTATIONS (Rudder AI, Vercel AI SDK, a direct
//     Anthropic provider). It is a SINGLE-provider seam: one setAiProvider, like setAdapter.
//   - the chosen implementation is agnostic over LLM VENDORS internally (claude / gemini /
//     openai). Vendor selection is a per-call field the provider interprets, so it never
//     leaks into this seam:  generate({ prompt, model: 'claude-...' })  /  { provider: 'gemini' }
// Whether to register two independent providers at once is deferred until a real need
// (YAGNI, the discipline that delayed createPort); this seam stays single-provider.
//
// Unlike vike-mail (fire-and-forget through vike-queue), AI is REQUEST-PATH: callers want
// the result back, so generate/chat/stream resolve the provider and return its value
// directly. No queue dependency.
//
// Optional-runtime, like the ORM adapter and vike-mail's console transport: with no
// provider registered, the built-in echo provider runs, so AI-using code paths work with
// zero config (and are obviously fake, never a silent real call).
//
// Server-only by design. A provider holds an API key + a live client, which cannot
// serialize through Vike config (the same reason vike-rudder registers at runtime, not in
// a config.js). Any future browser surface (a vike-ai/react chat box) is a separate, later
// subpath that talks to a server endpoint; it must never import this module into the
// client bundle.
import { createPort } from '@vike-data/kit'

// The zero-config default provider: echoes the input so AI-using code runs in dev/test
// without a key, and is unmistakably not a real model. This is the "memory adapter" of AI.
const ECHO = 'echo'

function echoText(input) {
  return `[echo] ${input}`
}

function defaultProvider() {
  return {
    async generate({ prompt, model, provider }) {
      const text = echoText(prompt)
      // eslint-disable-next-line no-console
      console.log(`[vike-ai] (dev, no provider) generate prompt=${JSON.stringify(prompt)}`)
      return { text, model: model ?? ECHO, provider: provider ?? ECHO }
    },
    async chat({ messages, model, provider }) {
      // Echo the latest user turn, the analog of echoing the prompt.
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const text = echoText(lastUser ? lastUser.content : '')
      // eslint-disable-next-line no-console
      console.log(`[vike-ai] (dev, no provider) chat turns=${messages.length}`)
      return {
        text,
        message: { role: 'assistant', content: text },
        model: model ?? ECHO,
        provider: provider ?? ECHO,
      }
    },
    // Native streaming so the streaming code path is genuinely swappable in dev, not faked
    // by the top-level fallback. Yields the echoed text a word at a time.
    async *stream({ prompt, messages }) {
      const source = prompt ?? (messages ? (messages.findLast?.((m) => m.role === 'user')?.content ?? '') : '')
      const text = echoText(source)
      const words = text.split(' ')
      for (let i = 0; i < words.length; i++) {
        yield i === 0 ? words[i] : ` ${words[i]}`
      }
    },
  }
}

// The provider registry (the set/get/clear port), over @vike-data/kit so the
// globalThis-Symbol caching + default fallback live in one audited place. A provider is
// `{ generate(req) -> Promise, chat(req) -> Promise, stream?(req) -> AsyncIterable<string> }`.
const providerPort = createPort({
  name: 'vike-ai.provider',
  validate: (p) => {
    if (!p || typeof p.generate !== 'function' || typeof p.chat !== 'function') {
      throw new Error('setAiProvider: expected a provider with generate(req) and chat(req) methods')
    }
    if (p.stream != null && typeof p.stream !== 'function') {
      throw new Error('setAiProvider: provider.stream, when present, must be a function')
    }
  },
  default: defaultProvider,
})

/** Register the app's AI provider. */
export function setAiProvider(provider) {
  providerPort.set(provider)
}

/** The registered provider, or the built-in echo default. */
export function getAiProvider() {
  return providerPort.get()
}

/** Clear the registered provider (tests). */
export function clearAiProvider() {
  providerPort.clear()
}

// Request shaping. model/provider are part of the contract from day one so a multi-vendor
// provider can route per call; vike-ai forwards them untouched and never interprets them.
function normalizeGenerate(request) {
  if (!request || typeof request !== 'object') throw new Error('generate: request must be an object')
  const { prompt } = request
  if (typeof prompt !== 'string' || prompt === '') throw new Error('generate: request.prompt is required')
  return request
}

function normalizeChat(request) {
  if (!request || typeof request !== 'object') throw new Error('chat: request must be an object')
  const { messages } = request
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('chat: request.messages must be a non-empty array')
  }
  for (const m of messages) {
    if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
      throw new Error('chat: each message must be { role: string, content: string }')
    }
  }
  return request
}

/**
 * One-shot completion. Forwards to the registered provider (echo in dev). Pass `model`
 * and/or `provider` to steer a multi-vendor provider; vike-ai forwards them verbatim.
 * Returns whatever the provider returns (at least `{ text }`).
 */
export async function generate(request) {
  return getAiProvider().generate(normalizeGenerate(request))
}

/**
 * Multi-turn completion over `messages` ([{ role, content }, ...]). Same model/provider
 * steering as generate(). Returns whatever the provider returns (at least `{ text }`).
 */
export async function chat(request) {
  return getAiProvider().chat(normalizeChat(request))
}

/**
 * Streaming completion. Yields provider chunks (strings) as they arrive. Accepts either a
 * `prompt` (generate-style) or `messages` (chat-style) request.
 *
 * If the provider implements `stream`, it is used directly. Otherwise vike-ai falls back
 * to the provider's generate/chat and yields the full result as a single chunk, so
 * stream-consuming code keeps working against a non-streaming provider (degrades, never
 * throws for a missing capability).
 */
export async function* stream(request) {
  const isChat = request && typeof request === 'object' && Array.isArray(request.messages)
  const normalized = isChat ? normalizeChat(request) : normalizeGenerate(request)
  const provider = getAiProvider()
  if (typeof provider.stream === 'function') {
    yield* provider.stream(normalized)
    return
  }
  const { text } = isChat ? await provider.chat(normalized) : await provider.generate(normalized)
  yield text
}
