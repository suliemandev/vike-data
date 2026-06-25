// vike-ai-gemstack — the GemStack provider for the neutral vike-ai port.
//
// vike-ai owns the contract (generate/chat/stream + a single setAiProvider seam, the AI
// twin of @universal-orm/core's setAdapter) and ships only the dev echo default. This
// package is the concrete provider that routes those calls to the GemStack AI engine
// (@gemstack/ai-sdk) — exactly as @universal-orm/rudder routes the neutral ORM ops to a
// real database. App code never changes: it keeps calling generate()/chat()/stream() on
// vike-ai; the app registers THIS provider once at server start.
//
//   import { registerGemstackAi } from 'vike-ai-gemstack'
//   registerGemstackAi({ model: 'anthropic/claude-...' })   // once, at server start
//
//   import { generate } from 'vike-ai'                       // anywhere after
//   const { text } = await generate({ prompt: 'Summarize ...' })
//
// Provider-vendor split (vike-ai #175): vike-ai is agnostic over AI IMPLEMENTATIONS (this
// is one); the implementation is agnostic over LLM VENDORS internally. GemStack already
// speaks "provider/model" strings (anthropic/claude-..., openai/gpt-..., google/gemini-...),
// so vike-ai's per-call `model` / `provider` fields map straight onto that selector and
// never leak into the seam.
//
// Wiring split, mirroring @universal-orm/rudder: that adapter takes a connection the APP
// built (`createRudderAdapter(native)`); it does not open the database itself. Likewise this
// adapter does NOT register GemStack providers or hold API keys — the app wires GemStack's
// own AiRegistry (AiRegistry.register(AnthropicProvider) + AiRegistry.setDefault(...), or
// the GemStack service provider) and this package is the thin bridge over `agent()`. That
// keeps the one source of truth for keys/providers in GemStack, not duplicated here.
//
// Server-only, like the port: a registered GemStack provider holds an API key and a live
// client, so this module must never reach the client bundle.
import { setAiProvider } from 'vike-ai'
import { agent as defaultAgent } from '@gemstack/ai-sdk'

const DEFAULT_INSTRUCTIONS = 'You are a helpful assistant.'

// Resolve vike-ai's neutral { model, provider } pair to a GemStack "provider/model" string.
// Precedence: an explicit per-call model (already "provider/model", or bare + a provider
// field) wins; otherwise the provider configured on the adapter; otherwise undefined, which
// lets GemStack fall back to its AiRegistry default. vike-ai forwards these fields untouched,
// so this is the only place the two conventions meet.
function resolveModel(request, configModel) {
  const { model, provider } = request
  if (typeof model === 'string' && model !== '') {
    if (model.includes('/') || !provider) return model
    return `${provider}/${model}`
  }
  return configModel
}

// The provider segment of a "provider/model" string, for echoing back on the response the
// way the dev default reports its provider. undefined when no model was resolved.
function providerOf(modelString) {
  if (typeof modelString !== 'string') return undefined
  const slash = modelString.indexOf('/')
  return slash === -1 ? undefined : modelString.slice(0, slash)
}

function buildAgent(makeAgent, instructions, modelString) {
  const options = { instructions }
  if (modelString) options.model = modelString
  return makeAgent(options)
}

// Annotate a provider response with the resolved model/provider, mirroring the dev echo
// provider's `{ text, model, provider }` shape so consumers see a consistent envelope.
function withMeta(base, modelString) {
  const out = { ...base }
  if (modelString) {
    out.model = modelString
    const p = providerOf(modelString)
    if (p) out.provider = p
  }
  return out
}

/**
 * Build a vike-ai provider backed by the GemStack AI engine.
 *
 * @param {object}   [options]
 * @param {string}   [options.model]         default GemStack model string ("provider/model").
 *                                           A per-call `model`/`provider` on the request overrides it.
 * @param {string}   [options.instructions]  system prompt for the underlying agent
 *                                           (default: "You are a helpful assistant.").
 * @param {Function} [options.agent]         the GemStack `agent()` factory. Injectable so the
 *                                           bridge is testable without a live provider; defaults
 *                                           to the real one from @gemstack/ai-sdk.
 * @returns a `{ generate, chat, stream }` provider for `setAiProvider`.
 */
export function gemstackAi(options = {}) {
  const {
    model: configModel,
    instructions = DEFAULT_INSTRUCTIONS,
    agent: makeAgent = defaultAgent,
  } = options

  return {
    async generate(request) {
      const modelString = resolveModel(request, configModel)
      const ag = buildAgent(makeAgent, instructions, modelString)
      const res = await ag.prompt(request.prompt)
      return withMeta({ text: res.text }, modelString)
    },

    async chat(request) {
      const modelString = resolveModel(request, configModel)
      // System turns set the agent's instructions; the rest is the conversation. GemStack's
      // `messages` option sends the list verbatim (input is ignored when it is set), so the
      // full multi-turn history reaches the model, not just the last turn.
      const system = request.messages.filter((m) => m.role === 'system').map((m) => m.content)
      const turns = request.messages.filter((m) => m.role !== 'system')
      const instr = system.length ? system.join('\n\n') : instructions
      const ag = buildAgent(makeAgent, instr, modelString)
      const res = await ag.prompt('', { messages: turns })
      return withMeta(
        { text: res.text, message: { role: 'assistant', content: res.text } },
        modelString,
      )
    },

    async *stream(request) {
      const modelString = resolveModel(request, configModel)
      const isChat = Array.isArray(request.messages)
      const system = isChat
        ? request.messages.filter((m) => m.role === 'system').map((m) => m.content)
        : []
      const instr = system.length ? system.join('\n\n') : instructions
      const ag = buildAgent(makeAgent, instr, modelString)

      const { stream } = isChat
        ? ag.stream('', { messages: request.messages.filter((m) => m.role !== 'system') })
        : ag.stream(request.prompt)

      // GemStack streams rich chunks (text-delta, tool-call, usage, finish, ...). vike-ai's
      // stream() yields plain text, so forward only the text deltas; the rest is engine
      // bookkeeping the port does not model.
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta' && chunk.text) yield chunk.text
      }
    },
  }
}

/**
 * Register the GemStack provider on vike-ai in one call. Sugar for
 * `setAiProvider(gemstackAi(options))`; call once at server start.
 */
export function registerGemstackAi(options = {}) {
  setAiProvider(gemstackAi(options))
}
