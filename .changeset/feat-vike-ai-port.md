---
'vike-ai': minor
---

vike-ai: a neutral, server-only AI port. App code calls `generate({ prompt })`, `chat({ messages })`, or `stream(req)`; the app registers the concrete provider once with `setAiProvider`, the AI twin of the ORM's `setAdapter`. With no provider registered, a built-in echo provider runs so AI-using code paths work zero-config and are unmistakably fake (never a silent real call). The provider contract carries a per-call `model` / `provider` selector from day one, so multi-vendor providers (claude / gemini / openai) route inside the provider while this seam stays single-provider; vike-ai forwards those fields untouched. `stream()` uses the provider's `stream` when present and otherwise falls back to `generate`/`chat`, yielding the whole result as one chunk. Importing vike-ai pulls no provider code. Concrete providers (Rudder AI, a Vercel AI SDK adapter, a direct Anthropic provider) register behind the same seam and ship separately.
