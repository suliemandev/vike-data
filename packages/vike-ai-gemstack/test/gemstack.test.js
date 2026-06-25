import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generate as portGenerate,
  chat as portChat,
  stream as portStream,
  clearAiProvider,
} from 'vike-ai'
import { gemstackAi, registerGemstackAi } from '../src/index.js'

// A fake GemStack `agent()` factory: records how it was built/called and returns canned
// completions, so the bridge is tested without a live provider or API key. It mirrors the
// real surface the adapter touches: prompt(input, opts) and stream(input, opts).
function fakeAgent(record = { created: [], prompts: [], streams: [] }) {
  const factory = (options) => {
    record.created.push(options)
    return {
      async prompt(input, opts) {
        record.prompts.push({ input, opts, instructions: options.instructions, model: options.model })
        const last = opts?.messages ? opts.messages[opts.messages.length - 1]?.content : input
        return { text: `reply:${last}` }
      },
      stream(input, opts) {
        record.streams.push({ input, opts, instructions: options.instructions, model: options.model })
        async function* chunks() {
          yield { type: 'text-delta', text: 'Hello' }
          yield { type: 'usage', usage: { totalTokens: 1 } } // non-text chunk must be dropped
          yield { type: 'tool-call', toolCall: { name: 'noop' } } // dropped too
          yield { type: 'text-delta', text: ' world' }
          yield { type: 'finish' }
        }
        return { stream: chunks(), response: Promise.resolve({ text: 'Hello world' }) }
      },
    }
  }
  factory.record = record
  return factory
}

async function collect(iter) {
  const out = []
  for await (const c of iter) out.push(c)
  return out
}

test('generate forwards the prompt and returns the text', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent })
  const res = await provider.generate({ prompt: 'hello' })
  assert.equal(res.text, 'reply:hello')
  assert.equal(agent.record.prompts[0].input, 'hello')
})

test('generate resolves a bare model + provider into a GemStack model string', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent })
  const res = await provider.generate({ prompt: 'hi', model: 'claude-x', provider: 'anthropic' })
  assert.equal(agent.record.created[0].model, 'anthropic/claude-x')
  assert.equal(res.model, 'anthropic/claude-x')
  assert.equal(res.provider, 'anthropic')
})

test('an explicit provider/model string passes through untouched', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent, model: 'openai/gpt-default' })
  await provider.generate({ prompt: 'hi', model: 'google/gemini-pro', provider: 'anthropic' })
  // explicit "provider/model" wins over both the provider field and the config default
  assert.equal(agent.record.created[0].model, 'google/gemini-pro')
})

test('the configured model is the fallback when the request omits one', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent, model: 'openai/gpt-default' })
  await provider.generate({ prompt: 'hi' })
  assert.equal(agent.record.created[0].model, 'openai/gpt-default')
})

test('no model anywhere leaves the agent on its registry default', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent })
  const res = await provider.generate({ prompt: 'hi' })
  assert.equal('model' in agent.record.created[0], false)
  assert.equal('model' in res, false)
  assert.equal('provider' in res, false)
})

test('chat lifts system turns into instructions and sends the rest as messages', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent })
  const res = await provider.chat({
    messages: [
      { role: 'system', content: 'Be terse.' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'second' },
    ],
  })
  const call = agent.record.prompts[0]
  assert.equal(call.instructions, 'Be terse.')
  assert.equal(call.opts.messages.length, 3) // system stripped, 3 turns forwarded
  assert.equal(res.text, 'reply:second')
  assert.deepEqual(res.message, { role: 'assistant', content: 'reply:second' })
})

test('chat falls back to default instructions when there is no system turn', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent, instructions: 'House rules.' })
  await provider.chat({ messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(agent.record.prompts[0].instructions, 'House rules.')
})

test('stream yields only text deltas, dropping usage/tool/finish chunks', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent })
  const chunks = await collect(provider.stream({ prompt: 'go' }))
  assert.deepEqual(chunks, ['Hello', ' world'])
})

test('stream supports the chat shape (messages), stripping system turns', async () => {
  const agent = fakeAgent()
  const provider = gemstackAi({ agent })
  const chunks = await collect(
    provider.stream({ messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'go' }] }),
  )
  assert.deepEqual(chunks, ['Hello', ' world'])
  assert.equal(agent.record.streams[0].instructions, 's')
  assert.equal(agent.record.streams[0].opts.messages.length, 1)
})

// End-to-end through the real vike-ai port: registerGemstackAi must produce a provider the
// port accepts (generate + chat functions, optional stream), and route the port's calls to
// the GemStack engine.
test('registerGemstackAi wires a working provider into the vike-ai port', async () => {
  const agent = fakeAgent()
  try {
    registerGemstackAi({ agent, model: 'anthropic/claude-x' })

    const g = await portGenerate({ prompt: 'ping' })
    assert.equal(g.text, 'reply:ping')
    assert.equal(g.provider, 'anthropic')

    const c = await portChat({ messages: [{ role: 'user', content: 'yo' }] })
    assert.equal(c.text, 'reply:yo')

    const s = await collect(portStream({ prompt: 'go' }))
    assert.deepEqual(s, ['Hello', ' world'])
  } finally {
    clearAiProvider()
  }
})
