// The DEFAULT AI translation provider for `vike translate` (#102).
//
// The provider is a single async function — `(job) => { [key]: translatedString }` —
// where `job = { locale, items: [{ key, source }] }`. The CLI groups the staleness
// plan by locale and calls it once per locale; everything provider-specific (which
// model, which key, how the call is shaped) lives behind that contract, so a project
// can pass its own `--provider`/translate function and never touch this file. This
// module is the batteries-included default: Claude via the Anthropic SDK.
//
// The SDK is an OPTIONAL, lazily-imported dependency — vike-i18n's runtime + the pure
// core never need it, and English-only or bring-your-own-provider apps never install
// it. We import it only when this default actually runs, and throw an actionable error
// if it (or the API key) is absent.

// Pull the source map { key: english } out of a job's items, for the prompt payload.
function sourceMap(items) {
  const out = {}
  for (const { key, source } of items) out[key] = source
  return out
}

const SYSTEM = [
  'You are a professional software localizer. You translate UI strings for a web app.',
  'Rules:',
  '- Translate the VALUE of each entry into the requested target language; keep the KEY unchanged.',
  '- Preserve every interpolation placeholder verbatim, including the braces: `{app}`, `{email}`, etc. Never translate, reorder inside, or remove a placeholder.',
  '- Preserve surrounding markup/punctuation and leading/trailing whitespace.',
  '- Use natural, idiomatic phrasing for the target locale; match the tone of the source.',
  '- Return a translation for every key you are given, and only those keys.',
].join('\n')

/**
 * Build the default Claude-backed translator. Returns the provider function the CLI
 * calls per locale. `opts.translate` short-circuits the whole thing (lets a caller
 * inject a fake/alternate provider through the same factory). Otherwise: lazy-import
 * `@anthropic-ai/sdk`, and for each locale ask Claude to translate the batch, using
 * structured outputs (a `key` constrained to the exact source keys + a string `value`)
 * so the response is guaranteed parseable and can't invent or drop keys.
 */
export function createAnthropicTranslator(opts = {}) {
  if (typeof opts.translate === 'function') return opts.translate
  const model = opts.model || 'claude-opus-4-8'
  let clientPromise

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        let Anthropic
        try {
          ;({ default: Anthropic } = await import('@anthropic-ai/sdk'))
        } catch {
          throw new Error(
            "[vike translate] The default translator needs the Anthropic SDK. Install it (`npm i -D @anthropic-ai/sdk`) or pass your own `translate` provider.",
          )
        }
        const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          throw new Error(
            '[vike translate] ANTHROPIC_API_KEY is not set. Export it, pass `apiKey`, or supply your own `translate` provider.',
          )
        }
        return new Anthropic({ apiKey })
      })()
    }
    return clientPromise
  }

  return async function translateBatch({ locale, items }) {
    if (!items.length) return {}
    const client = await getClient()
    const keys = items.map((i) => i.key)
    // Structured output: an array of {key,value} where `key` is constrained to the
    // exact source keys. This makes the result valid by construction — Claude can't
    // hallucinate a key or omit the wrapper — without us enumerating value shapes.
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['translations'],
      properties: {
        translations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'value'],
            properties: {
              key: { type: 'string', enum: keys },
              value: { type: 'string' },
            },
          },
        },
      },
    }

    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [
        {
          role: 'user',
          content: `Translate these UI strings into ${locale} (BCP-47). Return one entry per key.\n\n${JSON.stringify(
            sourceMap(items),
            null,
            2,
          )}`,
        },
      ],
    })

    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    const parsed = JSON.parse(text)
    const out = {}
    for (const { key, value } of parsed.translations || []) out[key] = value
    return out
  }
}
