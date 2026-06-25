# vike-ai-gemstack

The [GemStack](https://github.com/gemstack-land/gemstack) provider for the [`vike-ai`](../vike-ai) port. `vike-ai` owns the neutral `generate()` / `chat()` / `stream()` contract and ships only a dev echo default; this package is the concrete provider that routes those calls to the GemStack AI engine ([`@gemstack/ai-sdk`](https://www.npmjs.com/package/@gemstack/ai-sdk)) — the AI twin of `@universal-orm/rudder` for the data port.

App code never changes: it keeps calling `vike-ai`. The app registers this provider once at server start.

## Usage

```js
// 1. Wire GemStack's own engine (provider + key). This is GemStack's API, not vike-ai's —
//    the one source of truth for credentials, exactly as the app builds the DB connection.
import { AiRegistry, AnthropicProvider } from '@gemstack/ai-sdk'
AiRegistry.register(AnthropicProvider)
AiRegistry.setDefault('anthropic/claude-sonnet-4-6')

// 2. Register the bridge on vike-ai, once at server start.
import { registerGemstackAi } from 'vike-ai-gemstack'
registerGemstackAi({ model: 'anthropic/claude-sonnet-4-6' })
```

```js
// 3. Anywhere after: depend only on the port.
import { generate, chat, stream } from 'vike-ai'

const { text } = await generate({ prompt: 'Summarize this changelog: ...' })

const reply = await chat({ messages: [{ role: 'user', content: 'Hi' }] })

for await (const chunk of stream({ prompt: 'Write a haiku' })) process.stdout.write(chunk)
```

`registerGemstackAi(options)` is sugar for `setAiProvider(gemstackAi(options))`; use `gemstackAi()` directly if you want the provider object without registering it.

## Per-call vendor selection

GemStack speaks `"provider/model"` strings (`anthropic/claude-...`, `openai/gpt-...`, `google/gemini-...`). `vike-ai` forwards its neutral `model` / `provider` request fields untouched, and this adapter maps them onto that selector:

```js
await generate({ prompt, model: 'openai/gpt-4o' })          // explicit "provider/model" wins
await generate({ prompt, model: 'gemini-pro', provider: 'google' }) // bare model + provider -> "google/gemini-pro"
await generate({ prompt })                                  // adapter's configured default, else GemStack's AiRegistry default
```

## Options

```js
gemstackAi({
  model,         // default "provider/model"; a per-call model/provider overrides it
  instructions,  // system prompt for the underlying agent (default: "You are a helpful assistant.")
  agent,         // the GemStack agent() factory; injectable for tests, defaults to the real one
})
```

## Design

This adapter is a **thin bridge**, mirroring `@universal-orm/rudder`: that adapter takes a database connection the app built (`createRudderAdapter(native)`) and never opens the database itself. Likewise this package never registers GemStack providers or holds API keys — the app wires GemStack's `AiRegistry` (or the GemStack service provider), and the bridge only translates `vike-ai`'s calls into `agent().prompt()` / `agent().stream()`. Keys and provider selection stay in one place: GemStack.

`chat()` lifts `system` turns into the agent's instructions and forwards the rest as the conversation, so multi-turn history reaches the model. `stream()` forwards GemStack's `text-delta` chunks and drops the engine's bookkeeping chunks (usage, tool calls, finish), since the port yields plain text.

Server-only: a registered GemStack provider holds an API key and a live client, so this module must never reach the client bundle.
