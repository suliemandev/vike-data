# vike-ai

The AI port: `generate()`, `chat()`, and `stream()` plus a swappable provider. The AI twin of `@universal-orm/core`. App code depends on this neutral, server-only port; the app registers the concrete provider. The provider is the swappable implementation, the way memory/drizzle are for the ORM.

## Usage

```js
// app code: depend on the port, ask for a completion
import { generate } from 'vike-ai'
const { text } = await generate({ prompt: 'Summarize this changelog: ...' })
```

```js
// the app: register the provider once at server start
import { setAiProvider } from 'vike-ai'
setAiProvider(myProvider) // { generate(req), chat(req), stream?(req) }
```

`chat()` takes a message list; `stream()` yields chunks as they arrive:

```js
const { text } = await chat({ messages: [{ role: 'user', content: 'Hi' }] })

for await (const chunk of stream({ prompt: 'Write a haiku' })) process.stdout.write(chunk)
```

Calls are request-path (unlike `vike-mail`, which is background work through `vike-queue`): the result is returned to the caller.

## Two levels of provider-agnosticism

- **vike-ai** is agnostic over AI *implementations* (Rudder AI, a Vercel AI SDK provider, a direct Anthropic provider). It is a single-provider seam: one `setAiProvider`, like `setAdapter`.
- the chosen implementation is agnostic over LLM *vendors* internally (claude / gemini / openai). Vendor selection is a per-call field the provider interprets, so it never leaks into this seam:

```js
await generate({ prompt, model: 'claude-...' })   // or { provider: 'gemini' }
```

vike-ai forwards `model` / `provider` (and any other request fields) to the provider untouched and never interprets them.

## Zero-config default

With no provider registered, a built-in echo provider runs: it returns `[echo] <input>`, streams it a word at a time, and logs a one-liner. So AI-using code paths work with nothing wired (the role the memory adapter plays for data), and the result is unmistakably fake, never a silent real call. An app upgrades by calling `setAiProvider`.

## Provider contract

```js
const provider = {
  async generate({ prompt, model, provider, ...opts }) { /* -> { text, ... } */ },
  async chat({ messages, model, provider, ...opts }) { /* -> { text, ... } */ },
  async *stream(req) { /* yield string chunks (optional) */ },
}
```

`model` / `provider` are part of the contract from day one so a multi-vendor provider can route per call. `stream` is optional: when a provider omits it, `vike-ai`'s `stream()` falls back to the provider's `generate`/`chat` and yields the full result as one chunk, so stream-consuming code keeps working.

Real providers (Rudder AI, a Vercel AI SDK adapter, a thin Anthropic-only provider) implement this and are registered by the app; vike-ai ships only the port and the dev default. Server-only: a provider holds an API key and a live client, so this module must never reach the client bundle. A browser chat surface is a separate, later subpath that talks to a server endpoint.
